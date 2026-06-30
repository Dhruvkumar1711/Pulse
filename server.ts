import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getFirestore as clientGetFirestore, collection, addDoc, updateDoc, doc, getDoc, getDocs, deleteDoc, query, where, setDoc } from "firebase/firestore";
import { initializeApp as adminInitializeApp, getApps as adminGetApps, getApp as adminGetApp } from "firebase-admin/app";
import { getFirestore as adminGetFirestore } from "firebase-admin/firestore";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin on the server-side
let serverDb: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let app;
    if (adminGetApps().length === 0) {
      app = adminInitializeApp({
        projectId: config.projectId
      });
    } else {
      app = adminGetApp();
    }
    serverDb = adminGetFirestore(app, config.firestoreDatabaseId || undefined);
    console.info("Firebase Admin initialized successfully on server-side!");
  } else {
    console.warn("firebase-applet-config.json not found on server-side.");
  }
} catch (e: any) {
  console.info("Error initializing Firebase Admin on server-side:", e.message || e);
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI client lazily or if key is available
let ai: GoogleGenAI | null = null;
let geminiCooldownUntil = 0;

function triggerGeminiCooldown(error?: any) {
  let errStr = "";
  try {
    errStr = JSON.stringify(error).toLowerCase();
  } catch (e) {
    errStr = String(error).toLowerCase();
  }
  const errMsg = (String(error?.message || error?.error?.message || "") + " " + errStr).toLowerCase();
  // Only place Gemini on cooldown for actual Rate Limit / Quota Exceeded (429) errors.
  // Do not place on cooldown for temporary 503 server overloads, so fallback models can be tried.
  const shouldCooldown = errMsg.includes("quota") || 
                         errMsg.includes("limit") || 
                         errMsg.includes("429") || 
                         errMsg.includes("exhausted");
  
  if (shouldCooldown) {
    geminiCooldownUntil = Date.now() + 60000; // 60 seconds of silent fallback mode
    const finalMsg = error?.message || error?.error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.info(`[Pulse Guard] Gemini API placed on cooldown to prevent quota errors: ${finalMsg}`);
  }
}

function getGeminiClient() {
  if (Date.now() < geminiCooldownUntil) {
    return null; // Silent fallback: treat client as unavailable during cooldown
  }
  if (!ai) {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config && config.apiKey) {
            apiKey = config.apiKey;
            console.log("Using API key from firebase-applet-config.json for Gemini client");
          }
        }
      } catch (e) {
        console.warn("Failed to read apiKey from firebase-applet-config.json:", e);
      }
    }
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not configured. Intelligent prioritization fallback will be used.");
      return null;
    }
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

// Call Gemini with built-in retry and 429 rate limit backoff
async function callGeminiWithRetry(client: any, options: any, maxRetries = 1) {
  let attempt = 0;
  while (true) {
    try {
      return await client.models.generateContent(options);
    } catch (error: any) {
      const errStr = (error?.message || error?.error?.message || String(error)).toLowerCase();
      const isRateLimit = errStr.includes("quota") || 
                          errStr.includes("limit") || 
                          errStr.includes("429") || 
                          errStr.includes("exhausted");

      if (isRateLimit && attempt < maxRetries) {
        attempt++;
        let waitMs = 5000; // default to 5 seconds
        const matchSec = errStr.match(/retry after (\d+(\.\d+)?)\s*s/i) || 
                         errStr.match(/retry in (\d+(\.\d+)?)\s*s/i) ||
                         errStr.match(/backoff (\d+(\.\d+)?)\s*s/i);
        if (matchSec) {
          waitMs = parseFloat(matchSec[1]) * 1000 + 500;
        } else {
          const matchMin = errStr.match(/retry after (\d+)\s*m/i) || 
                           errStr.match(/retry in (\d+)\s*m/i);
          if (matchMin) {
            waitMs = parseInt(matchMin[1], 10) * 60 * 1000 + 1000;
          }
        }
        
        console.warn(`[Gemini Rate Limit] Attempt ${attempt} failed with 429. Waiting ${waitMs}ms before retrying once...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (isRateLimit) {
        // Place Gemini on cooldown to guard other features
        triggerGeminiCooldown(error);
        throw new Error("AI features are catching up, try again in a minute");
      }
      throw error;
    }
  }
}

// Intelligent Task Prioritization API Endpoint
function getHeuristicFallback(tasks: any[], currentTime: string | undefined, isQuotaLimit = false) {
  return tasks.map(t => {
    if (t.status === 'done') {
      return { taskId: t.id, priorityScore: 10, priorityReason: "Task completed." };
    }
    let urgency = 50;
    const now = currentTime ? new Date(currentTime) : new Date();
    
    if (t.deadline) {
      const deadlineDate = new Date(t.deadline);
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 0) urgency = 95; // Overdue
      else if (diffDays <= 1) urgency = 90; // Due tomorrow
      else if (diffDays <= 3) urgency = 75;
      else if (diffDays <= 7) urgency = 60;
      else urgency = 30;
    }
    
    // Effort factor (higher effort might need starting sooner or lower priority if not urgent)
    const effort = Number(t.estimatedMinutes) || 30;
    
    // Category weight
    const cat = (t.category || '').toLowerCase();
    let catWeight = 10;
    if (cat.includes('hackathon') || cat.includes('work') || cat.includes('urgent')) {
      catWeight = 25;
    } else if (cat.includes('personal') || cat.includes('habit')) {
      catWeight = 5;
    }
    
    const score = Math.min(100, Math.max(1, Math.round(urgency * 0.75 + catWeight + (effort > 120 ? 5 : 0))));
    
    // Human-like prioritization reasons
    let reason = "";
    if (t.deadline) {
      const deadlineDate = new Date(t.deadline);
      const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        reason = `Overdue task! Needs immediate resolution.`;
      } else if (diffDays === 0) {
        reason = `Due today. High urgency based on deadline.`;
      } else if (diffDays === 1) {
        reason = `Due tomorrow. High priority preparation required.`;
      } else {
        reason = `Due in ${diffDays} days. Moderate priority for category: ${t.category || 'General'}.`;
      }
    } else {
      reason = `Sized at ${effort}m in category: ${t.category || 'General'}. Normal priority flow.`;
    }

    if (isQuotaLimit) {
      reason = `[Pulse Local Engine] ${reason}`;
    }

    return {
      taskId: t.id,
      priorityScore: score,
      priorityReason: reason
    };
  });
}

app.post("/api/prioritize", async (req, res) => {
  const { tasks, currentTime } = req.body;
  try {
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.json({ success: true, prioritizations: [] });
    }

    const client = getGeminiClient();
    if (!client) {
      // Fallback simple algorithm if Gemini API Key is missing
      const fallback = getHeuristicFallback(tasks, currentTime, false);
      return res.json({ success: true, prioritizations: fallback });
    }

    // Prepare prompt
    const referenceTime = currentTime || new Date().toISOString();
    const prompt = `
Analyze this user's task list relative to the current reference time and return a priorityScore (0-100) and a concise one-line reason for each task.

Reference Time: ${referenceTime}
Tasks:
${JSON.stringify(tasks.map(t => ({
  id: t.id,
  title: t.title,
  deadline: t.deadline,
  estimatedMinutes: t.estimatedMinutes,
  category: t.category,
  status: t.status
})), null, 2)}

Requirements:
- Calculate a priorityScore from 0 to 100 for each task. Completed tasks (status: 'done') should have a very low score (e.g., 0-10).
- Weigh urgency (time remaining vs. estimated effort), category importance (e.g. Work, Hackathon, High-priority vs Personal), and dependency risk.
- Provide a concise, clear, human-like one-line explanation (under 100 characters) for each score.
`;

    let response;
    try {
      response = await callGeminiWithRetry(client, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's Intelligent Task Prioritization Engine. You analyze task details and deadlines to intelligently score priorities (0-100) and output professional, action-oriented, human-like justifications under 100 characters.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                taskId: {
                  type: Type.STRING,
                  description: "The unique identifier of the task."
                },
                priorityScore: {
                  type: Type.INTEGER,
                  description: "The priority score of the task from 0 to 100."
                },
                priorityReason: {
                  type: Type.STRING,
                  description: "A short, concise one-line explanation of the prioritization reasoning, under 100 characters."
                }
              },
              required: ["taskId", "priorityScore", "priorityReason"]
            }
          }
        }
      });
    } catch (apiError: any) {
      console.warn("Gemini prioritization API error: calling fallback model gemini-flash-latest...", apiError.message || apiError);
      // Fallback model if primary has other errors, wrapped in callGeminiWithRetry
      response = await callGeminiWithRetry(client, {
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's Intelligent Task Prioritization Engine. You analyze task details and deadlines to intelligently score priorities (0-100) and output professional, action-oriented, human-like justifications under 100 characters.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                taskId: {
                  type: Type.STRING,
                  description: "The unique identifier of the task."
                },
                priorityScore: {
                  type: Type.INTEGER,
                  description: "The priority score of the task from 0 to 100."
                },
                priorityReason: {
                  type: Type.STRING,
                  description: "A short, concise one-line explanation of the prioritization reasoning, under 100 characters."
                }
              },
              required: ["taskId", "priorityScore", "priorityReason"]
            }
          }
        }
      });
    }

    const text = response.text || "[]";
    const prioritizations = JSON.parse(text.trim());

    return res.json({
      success: true,
      prioritizations
    });

  } catch (error: any) {
    triggerGeminiCooldown(error);
    console.info("Gemini API prioritized scoring: falling back to Pulse local engine.", error.message || error);
    // Graceful fallback on API failure (e.g., 429 RESOURCE_EXHAUSTED)
    const fallback = getHeuristicFallback(tasks, currentTime, true);
    return res.json({
      success: true,
      prioritizations: fallback,
      fallbackUsed: true
    });
  }
});

// Goal breakdown fallback generator
function getGoalBreakdownFallback(title: string, targetDateStr: string, isQuotaLimit = false) {
  const targetDate = new Date(targetDateStr);
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const daysDiff = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  // Generate 3 standard milestones spread across target time
  const intervals = [0.25, 0.6, 0.9];
  const milestoneTitles = [
    `Research, planning & setup for ${title}`,
    `Core implementation & progress milestones for ${title}`,
    `Testing, QA & final adjustments for ${title}`
  ];

  const milestones = milestoneTitles.map((milestoneTitle, index) => {
    const daysToAdd = Math.round(daysDiff * intervals[index]);
    const dDate = new Date();
    dDate.setDate(now.getDate() + daysToAdd);
    return {
      title: milestoneTitle,
      dueDate: dDate.toISOString().split('T')[0]
    };
  });

  const category = `Goal: ${title}`;
  const tasks = [
    {
      title: `Kickoff & design architecture for ${title}`,
      description: `Review requirements and establish the roadmap for ${title}. ${isQuotaLimit ? '[Pulse Local Engine]' : ''}`,
      estimatedMinutes: 60,
      category,
      deadline: milestones[0].dueDate,
      milestoneTitle: milestones[0].title
    },
    {
      title: `Implement main functionality of ${title}`,
      description: `Code core modules and features to meet second milestone. ${isQuotaLimit ? '[Pulse Local Engine]' : ''}`,
      estimatedMinutes: 180,
      category,
      deadline: milestones[1].dueDate,
      milestoneTitle: milestones[1].title
    },
    {
      title: `Final verification and polishing of ${title}`,
      description: `Conduct testing, clean up bugs, and launch! ${isQuotaLimit ? '[Pulse Local Engine]' : ''}`,
      estimatedMinutes: 90,
      category,
      deadline: milestones[2].dueDate,
      milestoneTitle: milestones[2].title
    }
  ];

  return { milestones, tasks };
}

// AI-powered Goal breakdown API endpoint
app.post("/api/breakdown-goal", async (req, res) => {
  const { title, targetDate } = req.body;
  try {
    if (!title) {
      return res.status(400).json({ error: "Goal title is required" });
    }

    const client = getGeminiClient();
    if (!client) {
      const fallback = getGoalBreakdownFallback(title, targetDate || new Date().toISOString(), true);
      return res.json({ success: true, ...fallback });
    }

    const targetDateStr = targetDate ? new Date(targetDate).toDateString() : new Date().toDateString();
    const prompt = `
Analyze the goal/objective: "${title}" which has a target completion date of: ${targetDateStr}.
Break down this goal into a smart list of 3 sequential, actionable milestones and 3-5 corresponding tasks linked to these milestones (make sure each task is linked to one of the generated milestones by referencing its exact title).

Current Date: ${new Date().toDateString()}

Requirements:
- "milestones" should be exactly 3 logical phases, with "title" (under 80 characters) and "dueDate" (in YYYY-MM-DD format, which must be on or before the target date ${targetDateStr}).
- "tasks" should have:
  - "title": Clear and action-oriented.
  - "description": Explain the task's relevance and specific sub-tasks.
  - "estimatedMinutes": Realistic estimate, e.g., 45, 60, 120, 180.
  - "category": Must be set to "Goal: ${title}".
  - "deadline": YYYY-MM-DD (must be on or before the linked milestone's dueDate).
  - "milestoneTitle": MUST match the exact title of one of the generated milestones.
`;

    let response;
    try {
      response = await callGeminiWithRetry(client, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's Goal Breakdown Engine. You break down high-level user goals into structured milestone lists with suggested deadlines and generate linked actionable tasks.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              milestones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Clear and actionable milestone title" },
                    dueDate: { type: Type.STRING, description: "Milestone due date (YYYY-MM-DD format)" }
                  },
                  required: ["title", "dueDate"]
                }
              },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Task title" },
                    description: { type: Type.STRING, description: "Task description detailing the work" },
                    estimatedMinutes: { type: Type.INTEGER, description: "Estimated time in minutes" },
                    category: { type: Type.STRING, description: "Must be 'Goal: <Goal Title>'" },
                    deadline: { type: Type.STRING, description: "Task deadline (YYYY-MM-DD format)" },
                    milestoneTitle: { type: Type.STRING, description: "The exact title of the milestone this task belongs to" }
                  },
                  required: ["title", "description", "estimatedMinutes", "category", "deadline", "milestoneTitle"]
                }
              }
            },
            required: ["milestones", "tasks"]
          }
        }
      });
    } catch (primaryError: any) {
      console.info("Primary model 'gemini-3.1-flash-lite' failed, trying fallback 'gemini-flash-latest'...", primaryError.message || primaryError);
      // Fallback
      response = await callGeminiWithRetry(client, {
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's Goal Breakdown Engine. You break down high-level user goals into structured milestone lists with suggested deadlines and generate linked actionable tasks.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              milestones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    dueDate: { type: Type.STRING }
                  },
                  required: ["title", "dueDate"]
                }
              },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    estimatedMinutes: { type: Type.INTEGER },
                    category: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    milestoneTitle: { type: Type.STRING }
                  },
                  required: ["title", "description", "estimatedMinutes", "category", "deadline", "milestoneTitle"]
                }
              }
            },
            required: ["milestones", "tasks"]
          }
        }
      });
    }

    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    return res.json({
      success: true,
      milestones: result.milestones || [],
      tasks: result.tasks || []
    });

  } catch (error: any) {
    triggerGeminiCooldown(error);
    console.info("Goal breakdown local fallback engine activated.");
    const fallback = getGoalBreakdownFallback(title, targetDate || new Date().toISOString(), true);
    return res.json({
      success: true,
      ...fallback,
      fallbackUsed: true
    });
  }
});

// Companion insight fallback generator
function getCompanionInsightFallback(
  tasks: any[] = [],
  goals: any[] = [],
  habits: any[] = [],
  currentTime?: string
) {
  const now = currentTime ? new Date(currentTime) : new Date();
  
  const pendingTasks = (tasks || []).filter(t => t.status !== 'done');
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.deadline) return false;
    return new Date(t.deadline).getTime() < now.getTime();
  });
  
  const todayTasks = pendingTasks.filter(t => {
    if (!t.deadline) return false;
    const dDate = new Date(t.deadline);
    return dDate.getDate() === now.getDate() &&
           dDate.getMonth() === now.getMonth() &&
           dDate.getFullYear() === now.getFullYear();
  });

  if (overdueTasks.length > 0) {
    const mainTask = overdueTasks[0];
    return {
      title: "Overdue Task Needs Attention! ⚠️",
      message: `Your task "${mainTask.title}" is overdue. Let's knock it out first today to restore your peace of mind and momentum!`,
      priority: "high"
    };
  }

  if (todayTasks.length > 0) {
    const mainTask = todayTasks[0];
    return {
      title: "Today's Key Objective 🎯",
      message: `You have "${mainTask.title}" due today. Focus on completing this key task before exploring other secondary items.`,
      priority: "high"
    };
  }

  const activeHabits = (habits || []).filter(h => h.streak > 0);
  if (activeHabits.length > 0) {
    activeHabits.sort((a, b) => b.streak - a.streak);
    const mainHabit = activeHabits[0];
    return {
      title: "Maintain your Habit Streak! 🔥",
      message: `You are on an amazing ${mainHabit.streak}-day streak for "${mainHabit.name}"! Complete it today to keep your streak going!`,
      priority: "medium"
    };
  }

  const activeGoals = (goals || []).filter(g => g.progressPercent < 100);
  if (activeGoals.length > 0) {
    activeGoals.sort((a, b) => b.progressPercent - a.progressPercent);
    const mainGoal = activeGoals[0];
    return {
      title: "Goal Milestone Nearing! 🏆",
      message: `You have reached ${mainGoal.progressPercent}% progress on your goal "${mainGoal.title}". Taking a small step today will bring you closer to finishing.`,
      priority: "medium"
    };
  }

  if (pendingTasks.length > 0) {
    const highPri = pendingTasks.find(t => t.priorityScore && t.priorityScore > 70);
    if (highPri) {
      return {
        title: "High Priority Focus Recommended ⚡",
        message: `Your task list contains highly impactful work like "${highPri.title}". Schedule a dedicated focus block for this task.`,
        priority: "medium"
      };
    }
    return {
      title: "Keep the Momentum Steady 🌊",
      message: `You have ${pendingTasks.length} pending tasks in your workspace. Select one small item, complete it, and build your momentum.`,
      priority: "low"
    };
  }

  return {
    title: "Fresh Start & Clear Canvas 🌟",
    message: "You have no pending tasks today! Use this time to rest, set a new goal, or practice a positive habit.",
    priority: "low"
  };
}

// AI-powered Companion Insight API endpoint
app.post("/api/companion-insight", async (req, res) => {
  const { tasks, goals, habits, workingHours, currentTime } = req.body;
  try {
    const client = getGeminiClient();
    if (!client) {
      const fallback = getCompanionInsightFallback(tasks, goals, habits, currentTime);
      return res.json({ success: true, insight: fallback, fallbackUsed: true });
    }

    const referenceTime = currentTime || new Date().toISOString();
    const prompt = `
You are Pulse's Intelligent Productivity Coach. Analyze the user's workload, goals, and habits to deliver a highly tailored, non-generic, and deeply encouraging productivity insight.

1. Current State Summary:
- Tasks: ${JSON.stringify((tasks || []).map((t: any) => ({ title: t.title, status: t.status, priorityScore: t.priorityScore, deadline: t.deadline })))}
- Goals: ${JSON.stringify((goals || []).map((g: any) => ({ title: g.title, progressPercent: g.progressPercent, targetDate: g.targetDate })))}
- Habits: ${JSON.stringify((habits || []).map((h: any) => ({ name: h.name, streak: h.streak, frequency: h.frequency })))}

Reference Time: ${referenceTime}
Allowed Working Hours: ${workingHours?.start || "09:00"} - ${workingHours?.end || "17:00"}

Identify any urgent risks, streak restarts, or momentum opportunities, and generate a dynamic response with:
- "title": A catchy, motivating headline (under 50 characters).
- "message": A personalized, specific, and concise 2-sentence coaching suggestion.
- "priority": Classified strictly as "high", "medium", or "low".
`;

    let response;
    try {
      response = await callGeminiWithRetry(client, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's custom AI Productivity Companion. Analyze the user's state and provide actionable, encouraging, highly personalized insights in JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "A catchy, short, and relevant advice title." },
              message: { type: Type.STRING, description: "A highly personalized 2-sentence feedback or suggestion based on their actual list." },
              priority: { type: Type.STRING, description: "The urgency of this advice (must be 'high', 'medium', or 'low')." }
            },
            required: ["title", "message", "priority"]
          }
        }
      });
    } catch (primaryError: any) {
      console.info("Primary model 'gemini-3.1-flash-lite' failed, trying fallback 'gemini-flash-latest'...", primaryError.message || primaryError);
      try {
        response = await callGeminiWithRetry(client, {
          model: "gemini-flash-latest",
          contents: prompt,
          config: {
            systemInstruction: "You are Pulse's custom AI Productivity Companion. Analyze the user's state and provide actionable, encouraging, highly personalized insights in JSON.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "A catchy, short, and relevant advice title." },
                message: { type: Type.STRING, description: "A highly personalized 2-sentence feedback or suggestion based on their actual list." },
                priority: { type: Type.STRING, description: "The urgency of this advice (must be 'high', 'medium', or 'low')." }
              },
              required: ["title", "message", "priority"]
            }
          }
        });
      } catch (secondaryError: any) {
        console.info("Secondary model 'gemini-flash-latest' failed on companion insight, routing to fallback.", secondaryError.message || secondaryError);
        throw secondaryError;
      }
    }

    const parsed = JSON.parse(response.text.trim());
    return res.json({ success: true, insight: parsed });
  } catch (error: any) {
    triggerGeminiCooldown(error);
    const errMsg = String(error?.message || error || "").toLowerCase();
    const isQuotaError = errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("429") || errMsg.includes("exhausted");
    
    if (isQuotaError) {
      console.info("Gemini companion-insight API: Rate limit or quota exceeded. Instantly routing to smart local fallback engine.");
    } else {
      console.info("Companion insight local fallback engine activated.");
    }
    const fallback = getCompanionInsightFallback(tasks, goals, habits, currentTime);
    return res.json({ success: true, insight: fallback, fallbackUsed: true });
  }
});

// Heuristic Fallback for Productivity Recommendations
function getRecommendationsFallback(
  tasks: any[] = [],
  goals: any[] = [],
  habits: any[] = [],
  currentTime?: string
) {
  const now = currentTime ? new Date(currentTime) : new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recommendations: any[] = [];

  // Filter tasks in the last 14 days
  const recentTasks = (tasks || []).filter((t: any) => {
    const createdTime = t.createdAt ? new Date(t.createdAt).getTime() : 0;
    const deadlineTime = t.deadline ? new Date(t.deadline).getTime() : 0;
    const completedTime = t.completedAt ? new Date(t.completedAt).getTime() : 0;
    
    return (
      createdTime >= fourteenDaysAgo.getTime() ||
      deadlineTime >= fourteenDaysAgo.getTime() ||
      completedTime >= fourteenDaysAgo.getTime()
    );
  });

  const pending = recentTasks.filter(t => t.status !== 'done');
  const completed = recentTasks.filter(t => t.status === 'done');

  // 1. Procrastination check
  const catCount: Record<string, number> = {};
  pending.forEach(t => {
    const cat = t.category || 'General';
    catCount[cat] = (catCount[cat] || 0) + 1;
  });
  let topProcrastinatedCat = '';
  let maxPending = 0;
  for (const [cat, count] of Object.entries(catCount)) {
    if (count > maxPending) {
      maxPending = count;
      topProcrastinatedCat = cat;
    }
  }

  if (topProcrastinatedCat && maxPending >= 2) {
    recommendations.push({
      title: `Beat Procrastination in ${topProcrastinatedCat} 🚀`,
      message: `You currently have ${maxPending} pending tasks in "${topProcrastinatedCat}". Try breaking down the largest item into smaller, 15-minute milestones to build momentum.`,
      category: "procrastination",
      type: "warning"
    });
  } else {
    recommendations.push({
      title: "Task Categories Balanced ⚖️",
      message: "Awesome job keeping your work distributed. Creating categorized tags helps you context-switch seamlessly.",
      category: "procrastination",
      type: "info"
    });
  }

  // 2. Habit risk
  const habitsAtRisk = (habits || []).filter(h => {
    if (!h.lastCompletedAt) return true;
    const lastCompleted = new Date(h.lastCompletedAt);
    const diffDays = (now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 2 && h.streak > 0;
  });

  if (habitsAtRisk.length > 0) {
    const targetHabit = habitsAtRisk[0];
    recommendations.push({
      title: `Keep your streak for "${targetHabit.name}" 🔥`,
      message: `Your streak of ${targetHabit.streak} days is at risk since you haven't logged this habit in over 48 hours. Take 5 minutes to complete it today!`,
      category: "habit_risk",
      type: "warning"
    });
  } else if ((habits || []).length > 0) {
    const topStreakHabit = [...(habits || [])].sort((a,b) => b.streak - a.streak)[0];
    if (topStreakHabit && topStreakHabit.streak > 0) {
      recommendations.push({
        title: `Spectacular streak for "${topStreakHabit.name}"! 🌟`,
        message: `You are rocking a ${topStreakHabit.streak}-day streak! Keep up this incredible consistency to solidify a healthy lifestyle routine.`,
        category: "habit_risk",
        type: "success"
      });
    }
  }

  // 3. Best focus time of day
  recommendations.push({
    title: "Protect your morning focus hours ⚡",
    message: "Based on your focus sessions, your peak cognitive window is typically between 09:00 AM and 11:30 AM. Schedule your highest-effort task here today!",
    category: "focus_time",
    type: "info"
  });

  return recommendations;
}

// AI-powered Personalized Productivity Recommendations API endpoint
app.post("/api/recommendations/generate", async (req, res) => {
  const { tasks, goals, habits, currentTime } = req.body;
  try {
    const client = getGeminiClient();
    if (!client) {
      const fallback = getRecommendationsFallback(tasks, goals, habits, currentTime);
      return res.json({ success: true, recommendations: fallback, fallbackUsed: true });
    }

    const referenceTime = currentTime || new Date().toISOString();
    const fourteenDaysAgo = new Date(new Date(referenceTime).getTime() - 14 * 24 * 60 * 60 * 1000);

    // Prepare prompt
    const recentTasks = (tasks || []).filter((t: any) => {
      const createdTime = t.createdAt ? new Date(t.createdAt).getTime() : 0;
      const deadlineTime = t.deadline ? new Date(t.deadline).getTime() : 0;
      const completedTime = t.completedAt ? new Date(t.completedAt).getTime() : 0;
      
      return (
        createdTime >= fourteenDaysAgo.getTime() ||
        deadlineTime >= fourteenDaysAgo.getTime() ||
        completedTime >= fourteenDaysAgo.getTime()
      );
    });

    const prompt = `
You are Pulse's Intelligent Productivity Advisor. Generate 2-3 highly personalized, encouraging, and specific productivity recommendations based on the user's last 14 days of activity.

Activity details (last 14 days):
- Tasks: ${JSON.stringify(recentTasks.map((t: any) => ({ title: t.title, status: t.status, category: t.category, deadline: t.deadline, completedAt: t.completedAt })))}
- Goals: ${JSON.stringify((goals || []).map((g: any) => ({ title: g.title, progressPercent: g.progressPercent, targetDate: g.targetDate })))}
- Habits: ${JSON.stringify((habits || []).map((h: any) => ({ name: h.name, streak: h.streak, frequency: h.frequency, lastCompletedAt: h.lastCompletedAt })))}

Reference Time: ${referenceTime}

Your recommendations should cover:
1. Best Focus Time of Day recommendation (typically morning focus optimization, but tailored if you notice patterns).
2. Procrastination check (identify if there is a specific category or goal they are falling behind or procrastinating on).
3. Habit at Risk check (highlight any habit with active streaks that hasn't been completed in 2-3 days, or celebrate excellent streak consistency).

Ensure each recommendation is positive, brief, highly actionable, and tailored to the data. Use these fields:
- "title": Short, catchy advice title (under 50 characters).
- "message": Clear, encouraging 1-2 sentence recommendation.
- "category": Categorized as "focus_time", "procrastination", "habit_risk", or "general".
- "type": Visual indicator ('info', 'warning', or 'success').
`;

    let response;
    try {
      response = await callGeminiWithRetry(client, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's expert Productivity Advisor. You analyze the user's workload, habits, and goals to provide 2-3 encouraging, highly personalized, and action-oriented productivity recommendations in JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "A catchy, short advice title." },
                message: { type: Type.STRING, description: "A highly personalized 1-2 sentence advice based on their data." },
                category: { type: Type.STRING, description: "Must be focus_time, procrastination, habit_risk, or general." },
                type: { type: Type.STRING, description: "Visual category representation: info, warning, or success." }
              },
              required: ["title", "message", "category", "type"]
            }
          }
        }
      });
    } catch (primaryError: any) {
      triggerGeminiCooldown(primaryError);
      const errMsg = String(primaryError?.message || primaryError || "").toLowerCase();
      const isQuotaError = errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("429") || errMsg.includes("exhausted");
      
      if (isQuotaError) {
        console.info("Gemini recommendations API: Rate limit or quota exceeded. Instantly routing to smart local fallback engine.");
        const fallback = getRecommendationsFallback(tasks, goals, habits, currentTime);
        return res.json({ success: true, recommendations: fallback, fallbackUsed: true });
      }

      console.info("Primary recommendations model unavailable, trying fallback 'gemini-flash-latest'...", primaryError.message || primaryError);
      response = await callGeminiWithRetry(client, {
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's expert Productivity Advisor. You analyze the user's workload, habits, and goals to provide 2-3 encouraging, highly personalized, and action-oriented productivity recommendations in JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                message: { type: Type.STRING },
                category: { type: Type.STRING },
                type: { type: Type.STRING }
              },
              required: ["title", "message", "category", "type"]
            }
          }
        }
      });
    }

    const text = response.text || "[]";
    const parsed = JSON.parse(text.trim());
    return res.json({ success: true, recommendations: parsed });
  } catch (error: any) {
    triggerGeminiCooldown(error);
    console.info("Recommendations local fallback engine activated.");
    const fallback = getRecommendationsFallback(tasks, goals, habits, currentTime);
    return res.json({ success: true, recommendations: fallback, fallbackUsed: true });
  }
});

// Heuristic Fallback Day Scheduler
function getProposeScheduleFallback(
  tasks: any[],
  workingHours: { start: string; end: string },
  existingBlocks: any[],
  targetDateStr: string
) {
  const proposedBlocks: any[] = [];
  const atRiskTasks: any[] = [];

  const dateStr = targetDateStr.split('T')[0];
  const [startH, startM] = (workingHours.start || "09:00").split(':').map(Number);
  const [endH, endM] = (workingHours.end || "17:00").split(':').map(Number);

  const workStart = new Date(`${dateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`);
  const workEnd = new Date(`${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`);

  const totalIntervals = Math.floor((workEnd.getTime() - workStart.getTime()) / (15 * 60 * 1000));
  const busyIntervals = new Array(totalIntervals).fill(false);

  existingBlocks.forEach(block => {
    const bStart = new Date(block.start);
    const bEnd = new Date(block.end);
    
    if (bStart.getTime() < workEnd.getTime() && bEnd.getTime() > workStart.getTime()) {
      const overlapStart = Math.max(workStart.getTime(), bStart.getTime());
      const overlapEnd = Math.min(workEnd.getTime(), bEnd.getTime());
      
      const startIdx = Math.floor((overlapStart - workStart.getTime()) / (15 * 60 * 1000));
      const endIdx = Math.ceil((overlapEnd - workStart.getTime()) / (15 * 60 * 1000));
      
      for (let i = startIdx; i < endIdx; i++) {
        if (i >= 0 && i < totalIntervals) {
          busyIntervals[i] = true;
        }
      }
    }
  });

  const sortedTasks = [...tasks]
    .filter(t => t.status !== 'done')
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  sortedTasks.forEach(task => {
    const durationMin = Number(task.estimatedMinutes) || 45;
    const intervalsNeeded = Math.ceil(durationMin / 15);

    let foundStartIdx = -1;
    for (let i = 0; i <= totalIntervals - intervalsNeeded; i++) {
      let isFree = true;
      for (let j = 0; j < intervalsNeeded; j++) {
        if (busyIntervals[i + j]) {
          isFree = false;
          break;
        }
      }
      if (isFree) {
        foundStartIdx = i;
        break;
      }
    }

    if (foundStartIdx !== -1) {
      for (let j = 0; j < intervalsNeeded; j++) {
        busyIntervals[foundStartIdx + j] = true;
      }

      const bStart = new Date(workStart.getTime() + foundStartIdx * 15 * 60 * 1000);
      const bEnd = new Date(bStart.getTime() + durationMin * 60 * 1000);

      proposedBlocks.push({
        taskId: task.id,
        start: bStart.toISOString(),
        end: bEnd.toISOString()
      });

      if (task.deadline) {
        const deadline = new Date(task.deadline);
        deadline.setHours(23, 59, 59, 999);
        if (bEnd.getTime() > deadline.getTime()) {
          atRiskTasks.push({
            taskId: task.id,
            reason: `Scheduled after deadline (${task.deadline.split('T')[0]})`
          });
        }
      }
    } else {
      atRiskTasks.push({
        taskId: task.id,
        reason: "Could not fit into today's open working hours."
      });
    }
  });

  return { proposedBlocks, atRiskTasks };
}

// AI-powered Day Scheduling Proposal API endpoint
app.post("/api/propose-schedule", async (req, res) => {
  const { tasks, workingHours, existingBlocks, targetDate, currentTime } = req.body;
  try {
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Tasks list is required" });
    }

    const wHours = workingHours || { start: "09:00", end: "17:00" };
    const tDate = targetDate || new Date().toISOString();

    const client = getGeminiClient();
    if (!client) {
      console.info("No Gemini client found, using local scheduler fallback");
      const fallback = getProposeScheduleFallback(tasks, wHours, existingBlocks || [], tDate);
      return res.json({ success: true, ...fallback, fallbackUsed: true });
    }

    const referenceTimeStr = currentTime || new Date().toISOString();
    const prompt = `
Generate a proposed focus schedule for ${tDate.split('T')[0]} based on the following input:

1. Pending Tasks (with priority score and estimated minutes):
${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, priorityScore: t.priorityScore, estimatedMinutes: t.estimatedMinutes, deadline: t.deadline })), null, 2)}

2. Existing Calendar Events / Schedule Blocks (Do NOT overlap these, they are busy times!):
${JSON.stringify((existingBlocks || []).map((b: any) => ({ start: b.start, end: b.end })), null, 2)}

3. User's Allowed Working Hours on ${tDate.split('T')[0]}:
- Start: ${wHours.start}
- End: ${wHours.end}

Reference Current Time: ${referenceTimeStr}

Your instructions:
- Place as many of the highest priority tasks as possible into available slots within working hours.
- For each task you place, call the tool 'createScheduleBlock' with parameters: taskId, start (ISO 8601 string), and end (ISO 8601 string).
- Do NOT schedule overlapping blocks.
- If a task is high priority but cannot fit within the available hours, or if its scheduled time misses its deadline (${tDate.split('T')[0]}), call the tool 'flagTaskAtRisk' with parameters: taskId and reason.
`;

    let response;
    try {
      response = await callGeminiWithRetry(client, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's Intelligent Day Planner. Schedule user tasks into their open working hours without overlapping existing appointments or work. Call createScheduleBlock for each placed task and flagTaskAtRisk for high-priority items that cannot fit or will miss their deadline.",
          tools: [
            {
              functionDeclarations: [
                {
                  name: "createScheduleBlock",
                  description: "Schedule a pending task into an open time slot on the target day.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      taskId: { type: Type.STRING, description: "The ID of the task to schedule." },
                      start: { type: Type.STRING, description: "Start date/time of the block in ISO 8601 format." },
                      end: { type: Type.STRING, description: "End date/time of the block in ISO 8601 format." }
                    },
                    required: ["taskId", "start", "end"]
                  }
                },
                {
                  name: "flagTaskAtRisk",
                  description: "Flag a task that cannot be fit into the working hours or will miss its deadline.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      taskId: { type: Type.STRING, description: "The ID of the task that is at risk." },
                      reason: { type: Type.STRING, description: "The reason why the task is at risk (e.g., 'Working hours full', 'Misses deadline')." }
                    },
                    required: ["taskId", "reason"]
                  }
                }
              ]
            }
          ]
        }
      });
    } catch (primaryError: any) {
      console.info("Primary model 'gemini-3.1-flash-lite' unavailable on schedule, trying fallback 'gemini-flash-latest'...", primaryError.message || primaryError);
      response = await callGeminiWithRetry(client, {
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          systemInstruction: "You are Pulse's Intelligent Day Planner. Schedule user tasks into their open working hours without overlapping existing appointments or work. Call createScheduleBlock for each placed task and flagTaskAtRisk for high-priority items that cannot fit or will miss their deadline.",
          tools: [
            {
              functionDeclarations: [
                {
                  name: "createScheduleBlock",
                  description: "Schedule a pending task into an open time slot on the target day.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      taskId: { type: Type.STRING },
                      start: { type: Type.STRING },
                      end: { type: Type.STRING }
                    },
                    required: ["taskId", "start", "end"]
                  }
                },
                {
                  name: "flagTaskAtRisk",
                  description: "Flag a task that cannot be fit into the working hours or will miss its deadline.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      taskId: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ["taskId", "reason"]
                  }
                }
              ]
            }
          ]
        }
      });
    }

    const proposedBlocks: any[] = [];
    const atRiskTasks: any[] = [];

    const functionCalls = response.functionCalls || [];
    if (functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === "createScheduleBlock") {
          proposedBlocks.push(call.args);
        } else if (call.name === "flagTaskAtRisk") {
          atRiskTasks.push(call.args);
        }
      }
    } else {
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.functionCall) {
          const call = part.functionCall;
          if (call.name === "createScheduleBlock") {
            proposedBlocks.push(call.args);
          } else if (call.name === "flagTaskAtRisk") {
            atRiskTasks.push(call.args);
          }
        }
      }
    }

    if (proposedBlocks.length === 0 && atRiskTasks.length === 0) {
      console.info("Gemini returned no function calls, using fallback local scheduler");
      const fallback = getProposeScheduleFallback(tasks, wHours, existingBlocks || [], tDate);
      return res.json({ success: true, ...fallback, fallbackUsed: true });
    }

    return res.json({
      success: true,
      proposedBlocks,
      atRiskTasks
    });

  } catch (err: any) {
    triggerGeminiCooldown(err);
    console.info("Scheduler local fallback engine activated.");
    const fallback = getProposeScheduleFallback(tasks, workingHours || { start: "09:00", end: "17:00" }, existingBlocks || [], targetDate || new Date().toISOString());
    return res.json({
      success: true,
      ...fallback,
      fallbackUsed: true,
      error: err.message || err
    });
  }
});

// --- Voice Assistance Tools Configuration & Server-Side Execution ---

async function createTask(userId: string, params: any) {
  if (!serverDb) throw new Error("Database not initialized on server");
  const docRef = await serverDb.collection('tasks').add({
    title: params.title,
    description: params.description || 'Created via Voice Assistant',
    deadline: params.deadline || new Date().toISOString().split('T')[0],
    estimatedMinutes: Number(params.estimatedMinutes) || 30,
    category: params.category || 'General',
    status: params.status || 'todo',
    priorityScore: Number(params.priorityScore) || 50,
    priorityReason: 'Created via Pulse voice command.',
    userId: userId,
    createdAt: new Date().toISOString()
  });
  return { success: true, taskId: docRef.id, message: `Task "${params.title}" created successfully.` };
}

async function updateTask(userId: string, params: any) {
  if (!serverDb) throw new Error("Database not initialized on server");
  const { taskId, ...updates } = params;
  if (!taskId) throw new Error("taskId is required");
  const docRef = serverDb.collection('tasks').doc(taskId);
  const docSnap = await docRef.get();
  if (!docSnap.exists || docSnap.data()?.userId !== userId) {
    throw new Error(`Task with ID ${taskId} not found or permission denied`);
  }
  const cleanUpdates: any = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title;
  if (updates.status !== undefined) cleanUpdates.status = updates.status;
  if (updates.category !== undefined) cleanUpdates.category = updates.category;
  if (updates.deadline !== undefined) cleanUpdates.deadline = updates.deadline;
  if (updates.estimatedMinutes !== undefined) cleanUpdates.estimatedMinutes = Number(updates.estimatedMinutes);
  if (updates.priorityScore !== undefined) cleanUpdates.priorityScore = Number(updates.priorityScore);

  await docRef.update(cleanUpdates);
  return { success: true, message: `Task "${docSnap.data()?.title}" updated successfully.` };
}

async function rescheduleTask(userId: string, params: any) {
  if (!serverDb) throw new Error("Database not initialized on server");
  const { taskId, newDeadline } = params;
  if (!taskId || !newDeadline) throw new Error("taskId and newDeadline are required");
  const docRef = serverDb.collection('tasks').doc(taskId);
  const docSnap = await docRef.get();
  if (!docSnap.exists || docSnap.data()?.userId !== userId) {
    throw new Error(`Task with ID ${taskId} not found or permission denied`);
  }
  await docRef.update({ deadline: newDeadline });
  return { success: true, message: `Task "${docSnap.data()?.title}" rescheduled to ${newDeadline} successfully.` };
}

async function createScheduleBlock(userId: string, params: any) {
  if (!serverDb) throw new Error("Database not initialized on server");
  const { taskId, start, end } = params;
  if (!taskId || !start || !end) throw new Error("taskId, start, and end are required");
  
  // Look up the task to get its title
  const taskRef = serverDb.collection('tasks').doc(taskId);
  const taskSnap = await taskRef.get();
  const taskTitle = taskSnap.exists ? taskSnap.data()?.title : "Task Session";

  const blockRef = await serverDb.collection('scheduleBlocks').add({
    taskId,
    start,
    end,
    userId,
    title: taskTitle,
    createdAt: new Date().toISOString()
  });
  return { success: true, blockId: blockRef.id, message: `Schedule block created successfully for "${taskTitle}" from ${start} to ${end}.` };
}

async function createHabit(userId: string, params: any) {
  if (!serverDb) throw new Error("Database not initialized on server");
  const docRef = await serverDb.collection('habits').add({
    name: params.name,
    frequency: params.frequency || 'daily',
    streak: 0,
    userId: userId,
    createdAt: new Date().toISOString()
  });
  return { success: true, habitId: docRef.id, message: `Habit "${params.name}" created successfully.` };
}

async function completeHabit(userId: string, params: any) {
  if (!serverDb) throw new Error("Database not initialized on server");
  const { habitId } = params;
  if (!habitId) throw new Error("habitId is required");
  const docRef = serverDb.collection('habits').doc(habitId);
  const docSnap = await docRef.get();
  if (!docSnap.exists || docSnap.data()?.userId !== userId) {
    throw new Error(`Habit with ID ${habitId} not found or permission denied`);
  }
  const data = docSnap.data() || {};
  const currentStreak = data.streak || 0;
  const updates = {
    streak: currentStreak + 1,
    lastCompletedAt: new Date().toISOString()
  };
  await docRef.update(updates);
  return { success: true, message: `Habit "${data.name}" marked complete. Streak is now ${currentStreak + 1}.` };
}

async function createGoal(userId: string, params: any) {
  if (!serverDb) throw new Error("Database not initialized on server");
  const { title, targetDate, aiBreakdown } = params;
  if (!title) throw new Error("title is required");
  
  const defaultTargetDate = targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  let finalMilestones = [{ title: "Define parameters", dueDate: new Date().toISOString(), done: false }];
  let tasksToCreate: any[] = [];
  
  if (aiBreakdown !== false) {
    const client = getGeminiClient();
    if (client) {
      try {
        const targetDateStr = new Date(defaultTargetDate).toDateString();
        const prompt = `
          Analyze the goal/objective: "${title}" which has a target completion date of: ${targetDateStr}.
          Break down this goal into a smart list of 3 sequential, actionable milestones and 3-5 corresponding tasks linked to these milestones (make sure each task is linked to one of the generated milestones by referencing its exact title).
          Current Date: ${new Date().toDateString()}
          Requirements:
          - "milestones" should be exactly 3 logical phases, with "title" (under 80 characters) and "dueDate" (in YYYY-MM-DD format, on or before the target date ${targetDateStr}).
          - "tasks" should have:
            - "title": Clear and action-oriented.
            - "description": Explain the task's relevance and specific sub-tasks.
            - "estimatedMinutes": Realistic estimate, e.g., 45, 60, 120, 180.
            - "category": Must be set to "Goal: ${title}".
            - "deadline": YYYY-MM-DD (must be on or before the linked milestone's dueDate).
            - "milestoneTitle": MUST match the exact title of one of the generated milestones.
        `;
        const response = await callGeminiWithRetry(client, {
          model: "gemini-3.1-flash-lite",
          contents: prompt,
          config: {
            systemInstruction: "You are Pulse's Goal Breakdown Engine. You break down high-level user goals into structured milestone lists with suggested deadlines and generate linked actionable tasks.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                milestones: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      dueDate: { type: Type.STRING }
                    },
                    required: ["title", "dueDate"]
                  }
                },
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      estimatedMinutes: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                      deadline: { type: Type.STRING },
                      milestoneTitle: { type: Type.STRING }
                    },
                    required: ["title", "description", "estimatedMinutes", "category", "deadline", "milestoneTitle"]
                  }
                }
              },
              required: ["milestones", "tasks"]
            }
          }
        });
        
        if (response.text) {
          const data = JSON.parse(response.text);
          if (data.milestones && data.milestones.length > 0) {
            finalMilestones = data.milestones.map((m: any) => ({
              title: m.title,
              dueDate: new Date(m.dueDate).toISOString(),
              done: false
            }));
          }
          if (data.tasks && data.tasks.length > 0) {
            tasksToCreate = data.tasks;
          }
        }
      } catch (err) {
        console.warn("Failed to generate AI breakdown inside createGoal on server:", err);
      }
    }
  }
  
  const goalRef = await serverDb.collection('goals').add({
    title,
    targetDate: defaultTargetDate,
    progressPercent: 0,
    milestones: finalMilestones,
    userId: userId,
    createdAt: new Date().toISOString()
  });
  
  for (const task of tasksToCreate) {
    await serverDb.collection('tasks').add({
      title: task.title,
      description: task.description,
      deadline: task.deadline,
      estimatedMinutes: Number(task.estimatedMinutes) || 45,
      category: task.category,
      status: "todo",
      priorityScore: 50,
      priorityReason: `Generated to support milestone: ${task.milestoneTitle}`,
      userId: userId,
      createdAt: new Date().toISOString()
    });
  }
  
  return { 
    success: true, 
    goalId: goalRef.id, 
    message: `Goal "${title}" created successfully with ${finalMilestones.length} milestones and ${tasksToCreate.length} tasks.` 
  };
}

async function querySchedule(userId: string, params: any) {
  return { success: true, message: "Queried the user's schedule, tasks, habits, and goals." };
}

async function executeVoiceTool(userId: string, name: string, args: any) {
  try {
    if (name === "createTask") {
      return await createTask(userId, args);
    } else if (name === "updateTask") {
      return await updateTask(userId, args);
    } else if (name === "rescheduleTask") {
      return await rescheduleTask(userId, args);
    } else if (name === "createScheduleBlock") {
      return await createScheduleBlock(userId, args);
    } else if (name === "createHabit") {
      return await createHabit(userId, args);
    } else if (name === "completeHabit") {
      return await completeHabit(userId, args);
    } else if (name === "createGoal") {
      return await createGoal(userId, args);
    } else if (name === "querySchedule") {
      return await querySchedule(userId, args);
    } else {
      throw new Error(`Unknown function: ${name}`);
    }
  } catch (error: any) {
    console.error(`Error executing tool ${name}:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

const voiceTools = [
  {
    functionDeclarations: [
      {
        name: "createTask",
        description: "Creates a new task in the user's todo list.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "The title of the task (e.g. 'submit the report')."
            },
            description: {
              type: Type.STRING,
              description: "The optional detailed description of the task."
            },
            category: {
              type: Type.STRING,
              description: "The category of the task, e.g., 'Work', 'Hackathon', 'Personal', etc."
            },
            deadline: {
              type: Type.STRING,
              description: "The deadline for the task. Must be an ISO date-time string or YYYY-MM-DD format."
            },
            estimatedMinutes: {
              type: Type.INTEGER,
              description: "Estimated duration of the task in minutes."
            },
            priorityScore: {
              type: Type.INTEGER,
              description: "The priority score of the task from 1 to 100."
            }
          },
          required: ["title"]
        }
      },
      {
        name: "updateTask",
        description: "Updates or completes an existing task.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: "The ID of the task to update."
            },
            title: {
              type: Type.STRING,
              description: "The updated title."
            },
            status: {
              type: Type.STRING,
              description: "The status of the task.",
              enum: ["todo", "in_progress", "done"]
            },
            category: {
              type: Type.STRING,
              description: "The updated category."
            },
            deadline: {
              type: Type.STRING,
              description: "The updated deadline as an ISO date-time string or YYYY-MM-DD."
            },
            estimatedMinutes: {
              type: Type.INTEGER,
              description: "The updated estimate in minutes."
            },
            priorityScore: {
              type: Type.INTEGER,
              description: "The updated priority score from 1 to 100."
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "rescheduleTask",
        description: "Reschedules a task by changing its deadline or due date.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: "The ID of the task to reschedule."
            },
            newDeadline: {
              type: Type.STRING,
              description: "The new deadline date-time (ISO format or YYYY-MM-DD)."
            }
          },
          required: ["taskId", "newDeadline"]
        }
      },
      {
        name: "createScheduleBlock",
        description: "Schedule a pending task into an open focus session/time slot on the calendar.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: "The ID of the task to schedule."
            },
            start: {
              type: Type.STRING,
              description: "Start date/time of the block in ISO 8601 format."
            },
            end: {
              type: Type.STRING,
              description: "End date/time of the block in ISO 8601 format."
            }
          },
          required: ["taskId", "start", "end"]
        }
      },
      {
        name: "querySchedule",
        description: "Queries the user's schedule, tasks, habits, goals, or day to answer questions about what their day looks like or what they need to do.",
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      },
      {
        name: "createHabit",
        description: "Creates a new habit to track consistency (e.g. 'meditate daily', 'drink water').",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The name of the habit (e.g. 'drink water', 'meditate')."
            },
            frequency: {
              type: Type.STRING,
              description: "How often the user wants to practice this habit.",
              enum: ["daily", "weekly"]
            }
          },
          required: ["name"]
        }
      },
      {
        name: "completeHabit",
        description: "Logs or marks a habit as completed/done for today.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            habitId: {
              type: Type.STRING,
              description: "The ID of the habit to complete."
            }
          },
          required: ["habitId"]
        }
      },
      {
        name: "createGoal",
        description: "Creates a new long-term goal with a target deadline date.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "The title of the goal (e.g. 'build a mobile app')."
            },
            targetDate: {
              type: Type.STRING,
              description: "The target completion date (YYYY-MM-DD format)."
            },
            aiBreakdown: {
              type: Type.BOOLEAN,
              description: "Whether the AI should automatically break down this goal into actionable milestones and tasks."
            }
          },
          required: ["title"]
        }
      },
      {
        name: "deleteGoal",
        description: "Deletes a specific long-term goal. High-impact action.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            goalId: {
              type: Type.STRING,
              description: "The ID of the goal to delete."
            }
          },
          required: ["goalId"]
        }
      },
      {
        name: "clearReminders",
        description: "Clears or dismisses all active reminders. High-impact action.",
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      },
      {
        name: "deleteTask",
        description: "Deletes a specific task. High-impact action.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: "The ID of the task to delete."
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "deleteHabit",
        description: "Deletes a specific habit. High-impact action.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            habitId: {
              type: Type.STRING,
              description: "The ID of the habit to delete."
            }
          },
          required: ["habitId"]
        }
      }
    ]
  }
];

// Local voice command parser fallback
function getVoiceCommandFallback(command: string, tasks: any[], currentTime: string, habits: any[] = [], goals: any[] = []) {
  const normalized = command.toLowerCase().trim();
  const now = new Date(currentTime);

  // Check for clear reminders
  if (normalized.includes("reminder") && (normalized.includes("clear") || normalized.includes("delete") || normalized.includes("remove") || normalized.includes("dismiss all") || normalized.includes("wipe"))) {
    return {
      textResponse: "Are you sure you want to clear all reminders? This action is high-impact.",
      action: {
        type: "clearReminders",
        params: {}
      }
    };
  }

  // Check for delete goal
  if (normalized.includes("goal") && (normalized.includes("delete") || normalized.includes("remove") || normalized.includes("clear") || normalized.includes("destroy"))) {
    const match = goals.find(g => normalized.includes(g.title.toLowerCase()));
    if (match) {
      return {
        textResponse: `Are you sure you want to delete the goal "${match.title}"? This will also delete its milestones and tasks.`,
        action: {
          type: "deleteGoal",
          params: { goalId: match.id }
        }
      };
    }
  }

  // Check for delete task
  if (normalized.includes("task") && (normalized.includes("delete") || normalized.includes("remove") || normalized.includes("clear") || normalized.includes("destroy"))) {
    const match = tasks.find(t => normalized.includes(t.title.toLowerCase()));
    if (match) {
      return {
        textResponse: `Are you sure you want to delete the task "${match.title}"?`,
        action: {
          type: "deleteTask",
          params: { taskId: match.id }
        }
      };
    }
  }

  // Check for delete habit
  if (normalized.includes("habit") && (normalized.includes("delete") || normalized.includes("remove") || normalized.includes("clear") || normalized.includes("destroy"))) {
    const match = habits.find(h => normalized.includes(h.name.toLowerCase()));
    if (match) {
      return {
        textResponse: `Are you sure you want to delete the habit "${match.name}"?`,
        action: {
          type: "deleteHabit",
          params: { habitId: match.id }
        }
      };
    }
  }
  
  // 1. Check for complete habit or log habit
  if (normalized.includes("habit") && (normalized.includes("complete") || normalized.includes("log") || normalized.includes("done") || normalized.includes("check"))) {
    const match = habits.find(h => normalized.includes(h.name.toLowerCase()));
    if (match) {
      return {
        textResponse: `I've checked off your habit "${match.name}". Awesome job keeping up the streak!`,
        action: {
          type: "completeHabit",
          params: { habitId: match.id }
        }
      };
    }
  }

  // 2. Check for create habit
  if (normalized.includes("habit") && (normalized.includes("add") || normalized.includes("create") || normalized.includes("start"))) {
    let name = command.replace(/add habit|add a habit|create a habit|create habit|start habit|start a habit/gi, "").trim();
    name = name.replace(/daily|weekly/gi, "").trim();
    name = name.replace(/^(to|of)\s+/gi, "").trim();
    if (name.length > 0) {
      const frequency = normalized.includes("weekly") ? "weekly" : "daily";
      return {
        textResponse: `I've created a new ${frequency} habit: "${name}".`,
        action: {
          type: "createHabit",
          params: { name, frequency }
        }
      };
    }
  }

  // 3. Check for create goal
  if (normalized.includes("goal") && (normalized.includes("add") || normalized.includes("create") || normalized.includes("set"))) {
    let title = command.replace(/add goal|add a goal|create a goal|create goal|set goal|set a goal/gi, "").trim();
    title = title.replace(/^(to|of)\s+/gi, "").trim();
    const targetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (title.length > 0) {
      return {
        textResponse: `I've created your new goal: "${title}" targeting ${targetDate}. I'll also break it down into milestones!`,
        action: {
          type: "createGoal",
          params: { title, targetDate, aiBreakdown: true }
        }
      };
    }
  }

  // 4. Check for complete / finish / done task
  if (normalized.includes("complete") || normalized.includes("finish") || normalized.includes("done")) {
    const match = tasks.find(t => normalized.includes(t.title.toLowerCase()) && t.status !== 'done');
    if (match) {
      return {
        textResponse: `I've marked the task "${match.title}" as completed. Great work!`,
        action: {
          type: "updateTask",
          params: { taskId: match.id, status: "done" }
        }
      };
    }
  }

  // 5. Check for reschedule / move / delay task
  if (normalized.includes("reschedule") || normalized.includes("move") || normalized.includes("postpone") || normalized.includes("delay")) {
    const match = tasks.find(t => normalized.includes(t.title.toLowerCase()));
    if (match) {
      let newDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      let dateStr = "tomorrow";
      if (normalized.includes("next week")) {
        newDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        dateStr = "next week";
      } else if (normalized.includes("friday")) {
        const day = now.getDay();
        const daysToAdd = (5 - day + 7) % 7 || 7;
        newDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        dateStr = "this Friday";
      }
      return {
        textResponse: `Sure, I've rescheduled "${match.title}" to ${dateStr}.`,
        action: {
          type: "rescheduleTask",
          params: { taskId: match.id, newDeadline: newDate.toISOString().split('T')[0] }
        }
      };
    }
  }

  // 6. Check for add / create task
  if (normalized.includes("add") || normalized.includes("create") || normalized.includes("schedule a task")) {
    let title = command;
    title = title.replace(/add a task to|add task to|create a task to|create task to|add task|create task/gi, "").trim();
    let deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (normalized.includes("by friday")) {
      const day = now.getDay();
      const daysToAdd = (5 - day + 7) % 7 || 7;
      deadline = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      title = title.replace(/by friday/gi, "").trim();
    } else if (normalized.includes("by tomorrow")) {
      deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      title = title.replace(/by tomorrow/gi, "").trim();
    } else if (normalized.includes("by today")) {
      deadline = now.toISOString().split('T')[0];
      title = title.replace(/by today/gi, "").trim();
    }
    
    title = title.replace(/^(submit|do|finish|complete|write|make)\s+/gi, "").trim();
    if (title.length > 0) {
      return {
        textResponse: `I've created a new task to "${title}" with a deadline of ${deadline}.`,
        action: {
          type: "createTask",
          params: { title, deadline, status: "todo", category: "Work", estimatedMinutes: 30 }
        }
      };
    }
  }

  // 7. Query schedule
  if (normalized.includes("look like") || normalized.includes("schedule") || normalized.includes("day") || normalized.includes("todo") || normalized.includes("tasks")) {
    const todoTasks = tasks.filter(t => t.status !== 'done');
    if (todoTasks.length === 0) {
      return {
        textResponse: "Your todo list is completely empty! You are all caught up for the day."
      };
    }
    const taskSummary = todoTasks.slice(0, 3).map(t => t.title).join(", ");
    return {
      textResponse: `Today you have ${todoTasks.length} pending tasks. Your top priorities are: ${taskSummary}.`
    };
  }

  return {
    textResponse: "I'm Pulse, your AI productivity companion. Tell me to manage tasks, goals, or habits, or ask me what your day looks like!"
  };
}

// Voice assistance endpoint
app.post("/api/voice/command", async (req, res) => {
  const { command, tasks = [], currentTime = new Date().toISOString(), habits = [], goals = [], userId } = req.body;
  
  if (!command) {
    return res.status(400).json({ success: false, error: "Command text is required." });
  }

  const client = getGeminiClient();
  if (!client) {
    const fallback = getVoiceCommandFallback(command, tasks, currentTime, habits, goals);
    return res.json({ success: true, ...fallback, fallbackUsed: true });
  }

  try {
    const referenceTime = currentTime;
    const prompt = `
The user is talking to Pulse, their voice-enabled AI productivity companion.
Your job is to parse their voice command and decide which function/tool to call to execute their intent.

Current Local Time: ${referenceTime}
Today is: ${new Date(referenceTime).toDateString()}

Active Tasks list:
${JSON.stringify(tasks.map((t: any) => ({ id: t.id, title: t.title, deadline: t.deadline, category: t.category, status: t.status, priority: t.priorityScore })), null, 2)}

Active Habits list:
${JSON.stringify(habits.map((h: any) => ({ id: h.id, name: h.name, frequency: h.frequency, streak: h.streak })), null, 2)}

Active Goals list:
${JSON.stringify(goals.map((g: any) => ({ id: g.id, title: g.title, progressPercent: g.progressPercent, targetDate: g.targetDate })), null, 2)}

User Command: "${command}"

Instructions:
1. If the user wants to add/create a task, call the 'createTask' function with the parsed parameters.
2. If the user wants to update, modify, complete, or finish a task, call 'updateTask'. Make sure to map task titles in the user's command to the correct taskId from the active tasks list.
3. If the user wants to reschedule or change the due date of a task, call 'rescheduleTask'. Map the task title to the correct taskId.
4. If the user wants to add/create a habit, call 'createHabit' with the habit name and frequency (daily/weekly).
5. If the user wants to log, complete, or check off a habit, call 'completeHabit'. Match the habit name in their query to the correct habitId from the active habits list.
6. If the user wants to add/create a long-term goal, call 'createGoal' with the goal title and targetDate. Estimate a targetDate if none is provided (e.g. 1 month from now: ${new Date(new Date(referenceTime).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}).
7. If the user asks about their schedule, what they need to do, what their day looks like, or general status questions, call 'querySchedule'.
8. If the user wants to schedule a task into a specific time slot on their calendar, call 'createScheduleBlock' with taskId, start, and end time.
9. If the user wants to delete, remove, or clear a goal, call 'deleteGoal' with the mapped goalId from the goals list.
10. If the user wants to clear, delete, or dismiss all reminders, call 'clearReminders'.
11. If the user wants to delete, remove, or clear a task, call 'deleteTask' with the mapped taskId from the tasks list.
12. If the user wants to delete, remove, or clear a habit, call 'deleteHabit' with the mapped habitId from the habits list.
13. If none of the specific actions apply, do not call any function; reply directly with a friendly, helpful conversational response.
`;

    let response;
    try {
      response = await callGeminiWithRetry(client, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          tools: voiceTools
        }
      });
    } catch (primaryError: any) {
      console.info("Primary model 'gemini-3.1-flash-lite' unavailable on voice assistant, trying fallback 'gemini-flash-latest'...", primaryError.message || primaryError);
      response = await callGeminiWithRetry(client, {
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          tools: voiceTools
        }
      });
    }

    let action = null;
    let spokenText = "";
    let executedOnServer = false;
    let executionResult: any = null;

    // Check for function calls
    let functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.functionCall) {
          if (!functionCalls) functionCalls = [];
          functionCalls.push(part.functionCall);
        }
      }
    }

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      // Actually execute the action against Firestore on the server-side
      if (userId && serverDb) {
        try {
          executionResult = await executeVoiceTool(userId, call.name, call.args);
          if (executionResult && executionResult.success) {
            executedOnServer = true;
          }
        } catch (execErr: any) {
          executionResult = { success: false, error: execErr.message || String(execErr) };
        }
      } else {
        executionResult = { success: false, error: "Authentication or server database session unavailable." };
      }

      // Now do the second turn to get natural-language confirmation from Gemini
      const modelTurnParts = response.candidates?.[0]?.content?.parts || [{ functionCall: call }];
      const functionResultPayload = executionResult.success
        ? { success: true, result: executionResult.message || "Executed successfully." }
        : { success: false, error: executionResult.error || "Failed to execute." };

      const nextContents = [
        { role: "user", parts: [{ text: prompt }] },
        { role: "model", parts: modelTurnParts },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: call.name,
                response: functionResultPayload
              }
            }
          ]
        }
      ];

      try {
        const finalResponse = await callGeminiWithRetry(client, {
          model: "gemini-3.1-flash-lite",
          contents: nextContents,
          config: {
            tools: voiceTools
          }
        });
        spokenText = finalResponse.text || `I've successfully executed ${call.name}.`;
      } catch (finalErr) {
        console.warn("Error getting final natural language confirmation, using default spokenText:", finalErr);
        spokenText = executedOnServer 
          ? `I've successfully executed the action: ${executionResult.message || call.name}` 
          : `I encountered a problem trying to execute that action: ${executionResult.error || "Execution failed."}`;
      }

      action = {
        type: call.name,
        params: call.args,
        executedOnServer,
        result: executionResult
      };

    } else {
      spokenText = response.text || "I'm listening and ready to help you manage your tasks.";
    }

    let speechAudio = null;
    try {
      const ttsResponse = await callGeminiWithRetry(client, {
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say in a natural, friendly conversational tone: ${spokenText}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Zephyr" }
            }
          }
        }
      });
      speechAudio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr: any) {
      console.info("Gemini voice synthesis unavailable, falling back to browser-native voice:", ttsErr.message || ttsErr);
    }

    return res.json({
      success: true,
      textResponse: spokenText,
      speechAudio,
      action
    });

  } catch (err: any) {
    triggerGeminiCooldown(err);
    const errMsg = String(err?.message || err || "").toLowerCase();
    const isQuotaError = errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("429") || errMsg.includes("exhausted");
    if (isQuotaError) {
      console.info("Gemini voice assistant API: Rate limit or quota exceeded. Routing to local fallback.");
    } else {
      console.info("Voice assistant local fallback engine activated.");
    }
    const fallback = getVoiceCommandFallback(command, tasks, currentTime, habits, goals);
    return res.json({
      success: true,
      ...fallback,
      fallbackUsed: true,
      error: err.message || err
    });
  }
});

// --- Autonomous Task Planning & Execution Agent Config & Endpoint ---

const autonomousTools = [
  {
    functionDeclarations: [
      {
        name: "reprioritize_tasks",
        description: "Updates the priority score (1-100) and priority reason of tasks that need to be re-adjusted.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            updates: {
              type: Type.ARRAY,
              description: "List of tasks to reprioritize",
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING, description: "The ID of the task to update" },
                  priorityScore: { type: Type.INTEGER, description: "New priority score from 1 to 100" },
                  priorityReason: { type: Type.STRING, description: "Brief reason why the priority was adjusted (e.g. 'Overdue task priority boosted to encourage completion')" }
                },
                required: ["taskId", "priorityScore", "priorityReason"]
              }
            }
          },
          required: ["updates"]
        }
      },
      {
        name: "reschedule_tasks",
        description: "Postpones or reschedules task deadlines to clear up overdue status or balance an overloaded day.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            updates: {
              type: Type.ARRAY,
              description: "List of tasks to reschedule",
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING, description: "The ID of the task to reschedule" },
                  newDeadline: { type: Type.STRING, description: "New deadline date in YYYY-MM-DD format" },
                  reason: { type: Type.STRING, description: "Explanation for why this task was rescheduled" }
                },
                required: ["taskId", "newDeadline", "reason"]
              }
            }
          },
          required: ["updates"]
        }
      },
      {
        name: "move_schedule_blocks",
        description: "Shifts schedule blocks to clear up overlapping conflicts or move sessions to available times.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            updates: {
              type: Type.ARRAY,
              description: "List of schedule blocks to move to new times",
              items: {
                type: Type.OBJECT,
                properties: {
                  blockId: { type: Type.STRING, description: "The ID of the schedule block" },
                  newStart: { type: Type.STRING, description: "New start ISO date-time string" },
                  newEnd: { type: Type.STRING, description: "New end ISO date-time string" },
                  reason: { type: Type.STRING, description: "Explanation of why the schedule block was relocated" }
                },
                required: ["blockId", "newStart", "newEnd", "reason"]
              }
            }
          },
          required: ["updates"]
        }
      },
      {
        name: "split_stalled_goal",
        description: "Creates a small, actionable next action (a task) to help split a stalled goal and rebuild progress.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            goalId: { type: Type.STRING, description: "The ID of the stalled goal" },
            taskTitle: { type: Type.STRING, description: "The name/title of the new bite-sized next action task (e.g., 'Draft first slide of project deck')" },
            description: { type: Type.STRING, description: "A detailed, encouraging description of the first small step" },
            category: { type: Type.STRING, description: "Category for this task (e.g., 'Work', 'Hackathon', 'Personal')" },
            estimatedMinutes: { type: Type.INTEGER, description: "Estimated time in minutes (recommend 15-45 minutes)" },
            deadline: { type: Type.STRING, description: "Deadline date in YYYY-MM-DD format" }
          },
          required: ["goalId", "taskTitle", "description", "category", "estimatedMinutes", "deadline"]
        }
      },
      {
        name: "draft_habit_recovery_plan",
        description: "Creates an easy, low-friction recovery task to help the user rebuild momentum for a broken habit streak.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            habitId: { type: Type.STRING, description: "The ID of the habit with a broken streak" },
            taskTitle: { type: Type.STRING, description: "An encouraging, ultra-simple task title (e.g. 'Read just 2 pages to revive Reading habit')" },
            description: { type: Type.STRING, description: "An encouraging description with tips on recovering the streak" },
            deadline: { type: Type.STRING, description: "Deadline date in YYYY-MM-DD format" }
          },
          required: ["habitId", "taskTitle", "description", "deadline"]
        }
      }
    ]
  }
];

function getAutonomousFallback(tasks: any[], scheduleBlocks: any[], goals: any[], habits: any[], currentTime: string) {
  const actions: any[] = [];
  const details: string[] = [];
  const now = new Date(currentTime);
  const todayStr = now.toISOString().split('T')[0];

  // 1. Overdue tasks (missed deadlines)
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < todayStr);
  if (overdueTasks.length > 0) {
    const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const taskUpdates = overdueTasks.slice(0, 2).map(t => ({
      taskId: t.id,
      newDeadline: tomorrowStr,
      reason: "Automatically shifted overdue task to tomorrow for breathing room."
    }));
    actions.push({
      type: "reschedule_tasks",
      params: { updates: taskUpdates }
    });
    overdueTasks.slice(0, 2).forEach(t => {
      details.push(`• Overdue task "${t.title}" rescheduled to tomorrow.`);
    });
  }

  // 2. Overloaded day
  const todayTasks = tasks.filter(t => t.status !== 'done' && t.deadline === todayStr);
  const todayMinutes = todayTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
  if (todayMinutes > 240 && todayTasks.length > 2) {
    const lowestPriority = [...todayTasks].sort((a, b) => (a.priorityScore || 50) - (b.priorityScore || 50))[0];
    if (lowestPriority) {
      const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      actions.push({
        type: "reschedule_tasks",
        params: {
          updates: [{ taskId: lowestPriority.id, newDeadline: tomorrowStr, reason: "Shifted to tomorrow to balance overloaded day (exceeded 4 hours)." }]
        }
      });
      details.push(`• Shuffled "${lowestPriority.title}" to tomorrow to balance today's overload.`);
    }
  }

  // 3. Stalled goals
  const stalledGoals = goals.filter(g => g.progressPercent < 100);
  if (stalledGoals.length > 0) {
    const goal = stalledGoals[0];
    const incompleteMilestone = goal.milestones?.find((m: any) => !m.done);
    if (incompleteMilestone) {
      const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      actions.push({
        type: "split_stalled_goal",
        params: {
          goalId: goal.id,
          taskTitle: `Next step: ${incompleteMilestone.title}`,
          description: `Focus on completing the first micro-milestone for your goal "${goal.title}".`,
          category: "Work",
          estimatedMinutes: 30,
          deadline: tomorrowStr
        }
      });
      details.push(`• Split stalled goal "${goal.title}" into a bite-sized task: "${incompleteMilestone.title}".`);
    }
  }

  // 4. Broken habit streaks
  const brokenHabits = habits.filter(h => {
    if (h.streak > 0 && h.lastCompletedAt) {
      const lastDate = new Date(h.lastCompletedAt);
      const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      return h.frequency === 'daily' ? diffDays > 1.5 : diffDays > 8;
    }
    return false;
  });

  if (brokenHabits.length > 0) {
    const habit = brokenHabits[0];
    const todayStr = now.toISOString().split('T')[0];
    actions.push({
      type: "draft_habit_recovery_plan",
      params: {
        habitId: habit.id,
        taskTitle: `Revive: 10m on ${habit.name}`,
        description: `Your habit "${habit.name}" has had its streak broken. Let's start ultra-small to build back momentum!`,
        deadline: todayStr
      }
    });
    details.push(`• Drafted a habit recovery task to revive your momentum for "${habit.name}".`);
  }

  const message = details.length > 0 
    ? `Pulse Engine automatically detected and optimized your schedule:\n\n` + details.join('\n')
    : `Everything is currently in perfect sync! No changes were needed.`;

  return {
    success: true,
    actions,
    textResponse: message
  };
}

app.post("/api/autonomous/analyze-and-execute", async (req, res) => {
  const { tasks = [], scheduleBlocks = [], goals = [], habits = [], currentTime = new Date().toISOString() } = req.body;

  const client = getGeminiClient();
  if (!client) {
    const fallback = getAutonomousFallback(tasks, scheduleBlocks, goals, habits, currentTime);
    return res.json({ success: true, ...fallback, fallbackUsed: true });
  }

  try {
    const prompt = `
You are the Autonomous Task Planning & Execution Agent for "Pulse", a premium AI productivity companion.
Your role is to analyze the user's current tasks, schedule blocks, goals, and habits, detect specific productivity issues, and autonomously optimize them.

Current Local Time: ${currentTime}
Today is: ${new Date(currentTime).toDateString()}

We need to check and resolve four specific failure states:
1. Missed Deadlines: Any task that has a status other than 'done' and a deadline in the past.
   -> Solution: Reschedule the task to a future date (like tomorrow) to prevent feeling overwhelmed, and update its priority reason.
2. Overloaded Day: Any day (especially today) where the sum of estimated task durations (for tasks due today or scheduled today) exceeds 4 hours (240 minutes), or there are conflicting overlapping schedule blocks.
   -> Solution: Reprioritize tasks, move schedule blocks, or reschedule tasks to shift workload.
3. Stalled Goals: Goals that have not reached 100% progress and need focus.
   -> Solution: Split the goal's next milestone into a highly actionable, bite-sized next task (e.g., 15-45 minutes).
4. Broken Habit Streaks: Habits where the user had a streak (streak > 0) but has missed the timeframe (frequency: daily, last completed date was > 1.5 days ago, etc.).
   -> Solution: Create a highly actionable "recovery task" with a very low barrier to entry to jumpstart their momentum.

Current User Data:
- TASKS:
${JSON.stringify(tasks.map((t: any) => ({ id: t.id, title: t.title, deadline: t.deadline, category: t.category, status: t.status, priorityScore: t.priorityScore })), null, 2)}

- SCHEDULE BLOCKS:
${JSON.stringify(scheduleBlocks.map((b: any) => ({ id: b.id, taskId: b.taskId, start: b.start, end: b.end })), null, 2)}

- GOALS:
${JSON.stringify(goals.map((g: any) => ({ id: g.id, title: g.title, progressPercent: g.progressPercent, milestones: g.milestones })), null, 2)}

- HABITS:
${JSON.stringify(habits.map((h: any) => ({ id: h.id, name: h.name, streak: h.streak, lastCompletedAt: h.lastCompletedAt, frequency: h.frequency })), null, 2)}

Instructions:
- Call ONE or MORE functions from your available tools to autonomously apply the necessary optimizations.
- Do NOT make massive disruptive changes. Focus on targeted, helpful, surgical fixes to restore momentum and organization.
- If you call any tools, also provide a friendly, clear, human-like explanation of exactly WHAT you changed and WHY in your final text response candidate. Format the list of changes using standard bullet points so it is highly readable.
`;

    let response;
    try {
      response = await callGeminiWithRetry(client, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          tools: autonomousTools
        }
      });
    } catch (primaryError: any) {
      console.info("Primary model 'gemini-3.1-flash-lite' unavailable on autonomous agent, trying fallback 'gemini-flash-latest'...", primaryError.message || primaryError);
      response = await callGeminiWithRetry(client, {
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          tools: autonomousTools
        }
      });
    }

    const functionCalls = response.functionCalls || [];
    // Check inside candidate parts in case they are nested
    if (functionCalls.length === 0) {
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        }
      }
    }

    const actions = functionCalls.map(call => ({
      type: call.name,
      params: call.args
    }));

    const textResponse = response.text || "I've analyzed your schedule and applied optimizations to keep you on track.";

    return res.json({
      success: true,
      actions,
      textResponse
    });

  } catch (err: any) {
    triggerGeminiCooldown(err);
    console.info("Autonomous agent local fallback engine activated.");
    const fallback = getAutonomousFallback(tasks, scheduleBlocks, goals, habits, currentTime);
    return res.json({
      success: true,
      ...fallback,
      fallbackUsed: true,
      error: err.message || err
    });
  }
});

// Configure Vite middleware and static files serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
