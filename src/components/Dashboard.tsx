import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, ScheduleBlock, Goal, Habit, UserProfile, Recommendation } from '../types';
import { NeumorphicContainer, NeumorphicButton } from './Neumorphic';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  Sparkles, 
  Clock, 
  Hourglass, 
  Calendar, 
  CheckCircle2, 
  ArrowRight, 
  TrendingUp, 
  Play, 
  Undo2, 
  AlertCircle,
  Lightbulb,
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Trash2,
  Check,
  X,
  Sliders,
  CalendarClock,
  ArrowLeftRight,
  RefreshCw,
  Award,
  BookOpen
} from 'lucide-react';

interface DashboardProps {
  darkMode: boolean;
  userProfile: UserProfile | null;
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  goals: Goal[];
  habits: Habit[];
  recommendations?: Recommendation[];
  onRefreshRecommendations?: () => void;
  onDismissRecommendation?: (recId: string) => void;
  isRefreshingRecommendations?: boolean;
  onAutoSchedule: () => void;
  onUndoSchedule: () => void;
  hasRecentScheduleAction: boolean;
  recentActionExplanation: string | null;
  onNavigate: (tab: string) => void;
  onCompleteTask: (taskId: string, done: boolean) => void;
  isLocalMode?: boolean;
  onPrioritizeAll?: () => void;
  isPrioritizing?: boolean;
  onSaveProposedBlocks?: (blocks: Omit<ScheduleBlock, 'id' | 'userId'>[]) => void;
  hasAutonomousAction?: boolean;
  autonomousActionExplanation?: string | null;
  onUndoAutonomous?: () => void;
  onDismissAutonomous?: () => void;
  isAutonomousProcessing?: boolean;
  onTriggerAutonomous?: () => void;
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({
  darkMode,
  userProfile,
  tasks,
  scheduleBlocks,
  goals,
  habits,
  recommendations = [],
  onRefreshRecommendations,
  onDismissRecommendation,
  isRefreshingRecommendations = false,
  onAutoSchedule,
  onUndoSchedule,
  hasRecentScheduleAction,
  recentActionExplanation,
  onNavigate,
  onCompleteTask,
  isLocalMode,
  onPrioritizeAll,
  isPrioritizing,
  onSaveProposedBlocks,
  hasAutonomousAction = false,
  autonomousActionExplanation = null,
  onUndoAutonomous,
  onDismissAutonomous,
  isAutonomousProcessing = false,
  onTriggerAutonomous,
  onUpdateProfile,
}) => {
  const [nearestTask, setNearestTask] = useState<Task | null>(null);
  const [time, setTime] = useState(new Date());
  const [miniCalendarDate, setMiniCalendarDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [chronologicalNearestTask, setChronologicalNearestTask] = useState<Task | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const toggleExpandBlock = (blockId: string) => {
    setExpandedBlocks((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  };

  const [aiInsight, setAiInsight] = useState<{ title: string; message: string; priority: 'high' | 'medium' | 'low' }>({
    title: 'Workload Balance Peak',
    message: 'Your peak productivity slot is typically 09:00 - 11:00. You have 3 tasks due within 48 hours. We recommend auto-scheduling these into your morning slots.',
    priority: 'high',
  });

  const [isFetchingInsight, setIsFetchingInsight] = useState(false);

  const lastFetchTimeRef = useRef<number>(0);
  const lastSignatureRef = useRef<string>("");

  // AI-Powered Scheduling states
  const [isPlanning, setIsPlanning] = useState(false);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [proposedBlocks, setProposedBlocks] = useState<{
    id: string;
    taskId: string;
    start: string;
    end: string;
  }[]>([]);
  const [atRiskProposedTasks, setAtRiskProposedTasks] = useState<{
    taskId: string;
    reason: string;
  }[]>([]);
  const [planningDate, setPlanningDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const handleGenerateProposedSchedule = async (targetDateStr = planningDate) => {
    setIsGeneratingProposal(true);
    setProposedBlocks([]);
    setAtRiskProposedTasks([]);

    const pendingTasks = tasks.filter(t => t.status !== 'done');
    
    // Existing blocks for the chosen planning date
    const parts = targetDateStr.split('-');
    let targetDayStart: Date;
    let targetDayEnd: Date;
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      targetDayStart = new Date(y, m, d, 0, 0, 0, 0);
      targetDayEnd = new Date(y, m, d, 23, 59, 59, 999);
    } else {
      targetDayStart = new Date(targetDateStr);
      targetDayStart.setHours(0,0,0,0);
      targetDayEnd = new Date(targetDateStr);
      targetDayEnd.setHours(23,59,59,999);
    }

    const existingBlocksForDate = scheduleBlocks.filter(b => {
      const bStart = new Date(b.start);
      return bStart >= targetDayStart && bStart <= targetDayEnd;
    });

    try {
      const response = await fetch("/api/propose-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: pendingTasks,
          workingHours: {
            start: userProfile?.workingHours?.start || "09:00",
            end: userProfile?.workingHours?.end || "17:00"
          },
          existingBlocks: existingBlocksForDate,
          targetDate: targetDayStart.toISOString(),
          currentTime: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (data.success) {
        const blocks = (data.proposedBlocks || []).map((b: any, index: number) => ({
          ...b,
          id: `proposed_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`
        }));
        setProposedBlocks(blocks);
        setAtRiskProposedTasks(data.atRiskTasks || []);
      } else {
        console.error("Failed to generate schedule proposal:", data.error);
      }
    } catch (err) {
      console.error("Error proposing schedule:", err);
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  const handleAdjustBlockTime = (blockId: string, newStartMin: number) => {
    setProposedBlocks(prev => prev.map(block => {
      if (block.id !== blockId) return block;

      const blockStart = new Date(block.start);
      const blockEnd = new Date(block.end);
      const durationMs = blockEnd.getTime() - blockStart.getTime();

      const newStart = new Date(blockStart);
      newStart.setHours(Math.floor(newStartMin / 60));
      newStart.setMinutes(newStartMin % 60);
      newStart.setSeconds(0);
      newStart.setMilliseconds(0);

      const newEnd = new Date(newStart.getTime() + durationMs);

      return {
        ...block,
        start: newStart.toISOString(),
        end: newEnd.toISOString()
      };
    }));
  };

  const handleRejectBlock = (blockId: string) => {
    setProposedBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const handleAcceptProposedBlocks = () => {
    if (onSaveProposedBlocks && proposedBlocks.length > 0) {
      const blocksToSave = proposedBlocks.map(block => ({
        taskId: block.taskId,
        start: block.start,
        end: block.end,
        gcalEventId: null
      }));
      onSaveProposedBlocks(blocksToSave);
      setIsPlanning(false);
    }
  };

  const getPriorityBadgeClass = (score: number) => {
    if (score >= 75) return 'text-red-500 bg-red-500/10 dark:text-red-400';
    if (score >= 40) return 'text-amber-500 bg-amber-500/10 dark:text-amber-400';
    return 'text-green-500 bg-green-500/10 dark:text-green-400';
  };

  const getPriorityLabelText = (score: number) => {
    if (score >= 75) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  const formatTimeRemaining = (deadlineStr: string) => {
    const diff = new Date(deadlineStr).getTime() - new Date().getTime();
    if (diff <= 0) return 'Overdue';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `due in ${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `due in ${hours}h`;
    }
    return 'due in <1h';
  };

  // Calculate nearest deadline & upcoming deadlines
  useEffect(() => {
    const activeTasks = tasks.filter(t => t.status !== 'done' && t.deadline);
    if (activeTasks.length === 0) {
      setNearestTask(null);
      setChronologicalNearestTask(null);
      setUpcomingTasks([]);
      setTimeLeft(null);
      return;
    }

    const now = new Date().getTime();

    // 1. Calculate a composite score for each task to find the ultimate recommended focus task.
    // Composite Priority = Priority Score (0-100) + Urgency Bonus (0-120).
    // This perfectly balances both priorityScore (descending) and deadline (ascending),
    // guaranteeing that imminent low-priority tasks get escalated and handled correctly.
    const tasksWithComposite = activeTasks.map(t => {
      const deadlineTime = new Date(t.deadline).getTime();
      const diffMs = deadlineTime - now;
      const diffHrs = diffMs / (1000 * 60 * 60);

      let urgencyBonus = 0;
      if (diffHrs < 0) {
        urgencyBonus = 120; // Overdue tasks get a critical boost
      } else if (diffHrs <= 12) {
        urgencyBonus = 100; // Due within 12 hours
      } else if (diffHrs <= 24) {
        urgencyBonus = 80;  // Due within 24 hours
      } else if (diffHrs <= 48) {
        urgencyBonus = 50;  // Due within 2 days
      } else if (diffHrs <= 96) {
        urgencyBonus = 25;  // Due within 4 days
      } else if (diffHrs <= 168) {
        urgencyBonus = 10;  // Due within a week
      }

      const compositeScore = t.priorityScore + urgencyBonus;

      return { task: t, compositeScore, diffHrs };
    });

    // Sort descending by composite score, then ascending by deadline to find the Top Priority Focus task
    const sortedForFeatured = [...tasksWithComposite].sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) {
        return b.compositeScore - a.compositeScore;
      }
      return a.diffHrs - b.diffHrs;
    });

    const featured = sortedForFeatured[0].task;
    setNearestTask(featured);

    // 2. Identify the absolute chronological nearest deadline (purely nearest in time, regardless of priority)
    const sortedChronologically = [...activeTasks].sort((a, b) => {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const chronoNearest = sortedChronologically[0];
    setChronologicalNearestTask(chronoNearest);

    // 3. Populate upcoming tasks list (remaining active tasks sorted chronologically, excluding already highlighted tasks)
    const remaining = sortedChronologically.filter(t => t.id !== featured.id && t.id !== chronoNearest.id);
    setUpcomingTasks(remaining.slice(0, 3)); // Show up to 3 upcoming tasks
  }, [tasks]);

  // Update countdown timer
  useEffect(() => {
    if (!nearestTask) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const deadlineTime = new Date(nearestTask.deadline).getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [nearestTask]);

  // Generate dynamic AI insights based on the real task list, goals, and habits
  useEffect(() => {
    const todoTasks = tasks.filter(t => t.status !== 'done');
    const highPriorityTasks = todoTasks.filter(t => t.priorityScore >= 75);
    const completedTasks = tasks.filter(t => t.status === 'done');

    // 1. Check for "at risk" milestones
    const atRiskMilestones: { goalTitle: string; milestoneTitle: string; daysRemaining: number }[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    if (Array.isArray(goals)) {
      goals.forEach(goal => {
        if (Array.isArray(goal.milestones)) {
          goal.milestones.forEach(m => {
            if (!m.done && m.dueDate) {
              const dueDate = new Date(m.dueDate);
              dueDate.setHours(0,0,0,0);
              const diffMs = dueDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              
              if (diffDays <= 2) {
                atRiskMilestones.push({
                  goalTitle: goal.title,
                  milestoneTitle: m.title,
                  daysRemaining: diffDays
                });
              }
            }
          });
        }
      });
    }

    // 2. Check for "broken streaks" (streak is 0 and lastCompletedAt exists)
    const brokenHabits: Habit[] = Array.isArray(habits) 
      ? habits.filter(h => h.streak === 0 && h.lastCompletedAt)
      : [];

    let initialInsight: { title: string; message: string; priority: 'high' | 'medium' | 'low' };

    if (atRiskMilestones.length > 0) {
      const ms = atRiskMilestones[0];
      const urgencyText = ms.daysRemaining < 0 
        ? "is OVERDUE" 
        : ms.daysRemaining === 0 
          ? "is due TODAY" 
          : `is due in ${ms.daysRemaining} day${ms.daysRemaining === 1 ? '' : 's'}`;
      
      initialInsight = {
        title: `🚨 Milestone At Risk: ${ms.milestoneTitle}`,
        message: `Your milestone "${ms.milestoneTitle}" ${urgencyText} under Goal: "${ms.goalTitle}". Take action immediately to avoid pushing back your overall launch deadline.`,
        priority: 'high'
      };
    } else if (brokenHabits.length > 0) {
      const bh = brokenHabits[0];
      initialInsight = {
        title: `🔥 Routine Interrupted: ${bh.name}`,
        message: `Your habit streak for "${bh.name}" was recently reset to 0. Building steady, consecutive routines is key to peak productivity. Let's restart your streak today!`,
        priority: 'medium'
      };
    } else if (todoTasks.length === 0) {
      initialInsight = {
        title: 'Perfect Horizon',
        message: 'Splendid! You have zero pending tasks on your plate. Enjoy some downtime or outline your next big goal in the Goals tab.',
        priority: 'low'
      };
    } else if (highPriorityTasks.length > 2) {
      initialInsight = {
        title: 'Proactive Alert: High Workload Intensity',
        message: `You have ${highPriorityTasks.length} highly critical items requiring close attention. Use "Auto-Schedule" to book dedicated distraction-free time.`,
        priority: 'high'
      };
    } else {
      const percentage = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
      initialInsight = {
        title: 'Momentum Check',
        message: percentage > 0 
          ? `You have finalized ${percentage}% of tasks in this workspace. Keep this momentum rolling by tackling your next task listed below!`
          : 'Outline your daily high-priority items and use the intelligent auto-scheduler to craft an optimized focus flow.',
        priority: 'medium'
      };
    }

    const currentSignature = JSON.stringify({
      taskCount: tasks.length,
      doneCount: completedTasks.length,
      goalsCount: Array.isArray(goals) ? goals.length : 0,
      habitsCount: Array.isArray(habits) ? habits.length : 0,
      atRiskCount: atRiskMilestones.length,
      brokenCount: brokenHabits.length
    });

    const isFirstMountOfComponent = lastSignatureRef.current === "";

    if (userProfile?.dailyInsight) {
      setAiInsight(userProfile.dailyInsight);
      if (isFirstMountOfComponent) {
        lastSignatureRef.current = currentSignature;
        return;
      }
    } else {
      setAiInsight(initialInsight);
    }

    if (userProfile?.dailyInsight && userProfile?.dailyInsightSignature === currentSignature) {
      lastSignatureRef.current = currentSignature;
      return;
    }

    // Call server-side Gemini endpoint for real-time enhanced companion insights
    let isMounted = true;
    const fetchRealAiInsight = async () => {
      if (isFetchingInsight) return;
      setIsFetchingInsight(true);
      try {
        const res = await fetch("/api/companion-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks,
            goals,
            habits,
            workingHours: {
              start: userProfile?.workingHours?.start || "09:00",
              end: userProfile?.workingHours?.end || "17:00"
            },
            currentTime: new Date().toISOString()
          })
        });
        const data = await res.json();
        if (isMounted && data.success && data.insight) {
          setAiInsight(data.insight);
          if (onUpdateProfile) {
            await onUpdateProfile({
              dailyInsight: data.insight,
              dailyInsightSignature: currentSignature,
              dailyInsightUpdatedAt: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        console.info("Error fetching enhanced AI suggestions, using local fallback:", e);
      } finally {
        if (isMounted) {
          setIsFetchingInsight(false);
        }
      }
    };

    const shouldFetch = 
      currentSignature !== lastSignatureRef.current || 
      (Date.now() - lastFetchTimeRef.current > 300000); // 5 minutes cache fallback
 
    // Debounce background calls by 4 seconds to collapse rapid sequential state changes (e.g. initial loads)
    // AND enforce a minimum of 180 seconds cooldown between any automatic background fetches
    const delay = 4000;
    const timeoutId = setTimeout(() => {
      if (shouldFetch) {
        const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
        if (timeSinceLastFetch > 180000) { // 3 minutes cooldown
          lastSignatureRef.current = currentSignature;
          lastFetchTimeRef.current = Date.now();
          fetchRealAiInsight();
        }
      }
    }, delay);
 
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [tasks, goals, habits, userProfile, userProfile?.dailyInsightSignature]);

  const handleManualRefreshInsight = async () => {
    if (isFetchingInsight) return;
    setIsFetchingInsight(true);
    try {
      const res = await fetch("/api/companion-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks,
          goals,
          habits,
          workingHours: {
            start: userProfile?.workingHours?.start || "09:00",
            end: userProfile?.workingHours?.end || "17:00"
          },
          currentTime: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (data.success && data.insight) {
        setAiInsight(data.insight);
        lastFetchTimeRef.current = Date.now();
        
        // Compute signature variables locally
        const doneCount = tasks.filter(t => t.status === 'done').length;
        
        let atRiskCount = 0;
        const today = new Date();
        today.setHours(0,0,0,0);
        if (Array.isArray(goals)) {
          goals.forEach(goal => {
            if (Array.isArray(goal.milestones)) {
              goal.milestones.forEach(m => {
                if (!m.done && m.dueDate) {
                  const dueDate = new Date(m.dueDate);
                  dueDate.setHours(0,0,0,0);
                  const diffMs = dueDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  if (diffDays <= 2) {
                    atRiskCount++;
                  }
                }
              });
            }
          });
        }

        const brokenCount = Array.isArray(habits) 
          ? habits.filter(h => h.streak === 0 && h.lastCompletedAt).length
          : 0;

        // Update signature ref so we don't trigger background fetch immediately
        const sig = JSON.stringify({
          taskCount: tasks.length,
          doneCount,
          goalsCount: Array.isArray(goals) ? goals.length : 0,
          habitsCount: Array.isArray(habits) ? habits.length : 0,
          atRiskCount,
          brokenCount
        });
        lastSignatureRef.current = sig;

        if (onUpdateProfile) {
          await onUpdateProfile({
            dailyInsight: data.insight,
            dailyInsightSignature: sig,
            dailyInsightUpdatedAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.info("Error manually refreshing companion suggestions:", e);
    } finally {
      setIsFetchingInsight(false);
    }
  };

  // Get Today's schedule blocks (or active tasks today)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Today's scheduled blocks
  const todayBlocks = scheduleBlocks
    .filter(block => {
      const blockStart = new Date(block.start);
      return blockStart >= todayStart && blockStart <= todayEnd;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Link task details to blocks
  const getTaskForBlock = (taskId: string) => {
    return tasks.find(t => t.id === taskId);
  };

  const formatBlockTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (isPlanning) {
    return (
      <div className="space-y-8 pb-12">
        {/* Workspace Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <NeumorphicButton
              darkMode={darkMode}
              onClick={() => setIsPlanning(false)}
              className="p-2.5 rounded-full"
            >
              <X className="w-5 h-5 text-gray-500" />
            </NeumorphicButton>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                AI-Powered Day Planner
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Craft, preview, and customize your optimal daily timeline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Target Date:</label>
            <input
              type="date"
              value={planningDate}
              onChange={(e) => {
                setPlanningDate(e.target.value);
                handleGenerateProposedSchedule(e.target.value);
              }}
              className="px-3 py-1.5 rounded-xl text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono focus:outline-none text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {isGeneratingProposal ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 animate-pulse">
              Pulse AI is optimizing your schedule blocks...
            </p>
            <p className="text-xs text-gray-400 max-w-sm text-center">
              Evaluating priority scores, task deadlines, and your working hours ({userProfile?.workingHours?.start || "09:00"} - {userProfile?.workingHours?.end || "17:00"}) to build an overlap-free flow.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Timeline Column */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-indigo-500" />
                  Proposed Schedule Blocks ({proposedBlocks.length})
                </h3>
                {proposedBlocks.length > 0 && (
                  <span className="text-xs text-gray-400 font-mono">
                    Snap increment: 15m
                  </span>
                )}
              </div>

              {proposedBlocks.length === 0 ? (
                <NeumorphicContainer darkMode={darkMode} className="p-8 text-center space-y-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                    <Calendar className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300">No proposed blocks</h4>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                      All tasks are either completed, or working hours on {planningDate} are fully booked with appointments.
                    </p>
                  </div>
                  <NeumorphicButton
                    darkMode={darkMode}
                    onClick={() => handleGenerateProposedSchedule()}
                    className="py-2 px-4 text-xs"
                  >
                    Retry Generation
                  </NeumorphicButton>
                </NeumorphicContainer>
              ) : (
                <div className="relative border-l-2 border-indigo-100 dark:border-indigo-950/40 pl-6 space-y-6 ml-3">
                  {proposedBlocks.map((block) => {
                    const task = getTaskForBlock(block.taskId);
                    const bStart = new Date(block.start);
                    const bEnd = new Date(block.end);
                    const durationMin = Math.round((bEnd.getTime() - bStart.getTime()) / 60000);
                    
                    const startMin = bStart.getHours() * 60 + bStart.getMinutes();
                    const rangeMin = 360; // 06:00
                    const rangeMax = 1320 - durationMin; // 22:00 - duration

                    const isExceedingDeadline = task?.deadline && bEnd > new Date(task.deadline);

                    return (
                      <div key={block.id} className="relative group">
                        {/* Timeline node */}
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-500 bg-white dark:bg-gray-900 group-hover:scale-125 transition-transform duration-200"></div>

                        <NeumorphicContainer
                          darkMode={darkMode}
                          className={`p-5 relative ${
                            isExceedingDeadline 
                              ? 'shadow-[inset_0_0_12px_rgba(239,68,68,0.15)] border border-red-500/20' 
                              : ''
                          }`}
                        >
                          {/* Close/Reject Action */}
                          <button
                            onClick={() => handleRejectBlock(block.id)}
                            className="absolute top-4 right-4 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                            title="Remove from Proposal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
                                  {formatBlockTime(block.start)} - {formatBlockTime(block.end)}
                                </span>
                                <span className="text-xs text-gray-400">
                                  ({durationMin} mins)
                                </span>
                                {task?.category && (
                                  <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                                    {task.category}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-base font-bold text-gray-900 dark:text-white mt-1 pr-8">
                                {task?.title || 'Unknown Task'}
                              </h4>
                              {isExceedingDeadline && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>At Risk: End time is after deadline ({task?.deadline?.split('T')[0]})</span>
                                </div>
                              )}
                            </div>

                            {/* Drag to adjust slider */}
                            <div className="space-y-1.5 pt-2 border-t border-gray-50 dark:border-gray-800">
                              <div className="flex justify-between text-[11px] text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                                  Drag slider to adjust time slot:
                                </span>
                                <span className="font-mono text-gray-500 dark:text-gray-400">
                                  {formatBlockTime(block.start)}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={rangeMin}
                                max={rangeMax}
                                step={15}
                                value={startMin}
                                onChange={(e) => handleAdjustBlockTime(block.id, parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                              />
                            </div>
                          </div>
                        </NeumorphicContainer>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar Column: At Risk & Unscheduled Tasks */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-6 shadow-inner">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    At-Risk & Unscheduled Items
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    These tasks have deadlines soon but could not be automatically fit into open working hours.
                  </p>
                </div>

                {atRiskProposedTasks.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ✨ All pending tasks fit perfectly!
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {atRiskProposedTasks.map((item, index) => {
                      const task = getTaskForBlock(item.taskId);
                      return (
                        <div
                          key={`at-risk-${item.taskId}`}
                          className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-1.5 shadow-sm"
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                              {task?.title || 'Unknown Task'}
                            </h4>
                            {task?.priorityScore && (
                              <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded font-mono font-bold">
                                {task.priorityScore} Pts
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>{item.reason}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <NeumorphicButton
                  darkMode={darkMode}
                  variant="primary"
                  onClick={handleAcceptProposedBlocks}
                  disabled={proposedBlocks.length === 0}
                  className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Accept & Save Schedule
                </NeumorphicButton>

                <NeumorphicButton
                  darkMode={darkMode}
                  onClick={() => handleGenerateProposedSchedule()}
                  className="w-full py-3 text-sm flex items-center justify-center gap-2"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Regenerate Proposal
                </NeumorphicButton>

                <button
                  onClick={() => setIsPlanning(false)}
                  className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium text-center"
                >
                  Cancel Planning
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentMonthName = miniCalendarDate.toLocaleDateString(undefined, { month: 'long' });
  const currentYear = miniCalendarDate.getFullYear();

  const getMonthGrid = () => {
    const year = miniCalendarDate.getFullYear();
    const month = miniCalendarDate.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0-6
    
    // Number of days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const cells: (number | null)[] = [];
    
    // Fill empty cells before 1st of month
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }
    
    // Add month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    
    return cells;
  };

  const deadlineDaysSet = new Set(
    tasks
      .filter(task => {
        if (!task.deadline || task.status === 'done') return false;
        const d = new Date(task.deadline);
        return d.getFullYear() === miniCalendarDate.getFullYear() && d.getMonth() === miniCalendarDate.getMonth();
      })
      .map(task => new Date(task.deadline).getDate())
  );

  const secs = time.getSeconds();
  const mins = time.getMinutes();
  const hrs = time.getHours();

  const secDeg = secs * 6;
  const minDeg = mins * 6 + secs * 0.1;
  const hrDeg = (hrs % 12) * 30 + mins * 0.5;

  // getLast7DaysData calculates the tasks and habits completed on each of the last 7 days
  const getLast7DaysData = () => {
    const data = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const label = `${daysOfWeek[d.getDay()]} ${d.getDate()}`;
      
      // Tasks completed on this day
      const completedTasksCount = tasks.filter(t => {
        if (t.status !== 'done' || !t.completedAt) return false;
        const compDate = new Date(t.completedAt);
        const compYYYY = compDate.getFullYear();
        const compMM = String(compDate.getMonth() + 1).padStart(2, '0');
        const compDD = String(compDate.getDate()).padStart(2, '0');
        return `${compYYYY}-${compMM}-${compDD}` === dateStr;
      }).length;

      // Habits completed on this day
      const completedHabitsCount = habits.filter(h => {
        return h.completedDates?.some(dateVal => {
          if (dateVal.includes('T')) {
            return dateVal.split('T')[0] === dateStr;
          }
          return dateVal === dateStr;
        });
      }).length;

      // Total tasks due on this day
      const tasksDueCount = tasks.filter(t => {
        if (!t.deadline) return false;
        const dDate = new Date(t.deadline);
        const dYYYY = dDate.getFullYear();
        const dMM = String(dDate.getMonth() + 1).padStart(2, '0');
        const dDD = String(dDate.getDate()).padStart(2, '0');
        return `${dYYYY}-${dMM}-${dDD}` === dateStr;
      }).length;

      const activeDailyHabitsCount = habits.filter(h => h.frequency === 'daily').length;

      const completed = completedTasksCount + completedHabitsCount;
      const expected = tasksDueCount + activeDailyHabitsCount;
      
      let completionRate = 100;
      if (expected > 0) {
        completionRate = Math.min(100, Math.round((completed / expected) * 100));
      } else if (completed === 0) {
        completionRate = 0;
      }

      data.push({
        dateStr,
        label,
        completedTasks: completedTasksCount,
        completedHabits: completedHabitsCount,
        totalCompletions: completed,
        rate: completionRate,
      });
    }
    return data;
  };

  const chartData = getLast7DaysData();
  const totalTasksCompletedThisWeek = chartData.reduce((acc, item) => acc + item.completedTasks, 0);
  const totalHabitsCompletedThisWeek = chartData.reduce((acc, item) => acc + item.completedHabits, 0);
  const averageWeeklyRate = Math.round(chartData.reduce((acc, item) => acc + item.rate, 0) / 7);

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <NeumorphicContainer
          darkMode={darkMode}
          className="p-4 border border-gray-150/10 shadow-lg text-left bg-[#e6ebf2] dark:bg-[#1a1d24]"
          rounded="xl"
        >
          <p className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase">
            {label}
          </p>
          <div className="space-y-1.5 text-xs">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-4 justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {entry.name}:
                  </span>
                </span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {entry.value}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 dark:border-gray-800/40 mt-2 pt-2 flex items-center justify-between font-semibold">
              <span className="text-indigo-500 dark:text-indigo-400">Completion Rate:</span>
              <span className="font-mono text-indigo-500 dark:text-indigo-400">
                {payload[0]?.payload?.rate}%
              </span>
            </div>
          </div>
        </NeumorphicContainer>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Hello, {userProfile?.name?.split(' ')[0] || 'there'} 👋
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Let's keep your day synchronized and eliminate delay.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto lg:overflow-x-visible flex-nowrap lg:flex-wrap max-w-full pb-2 pt-1 lg:pb-0 lg:pt-0 justify-start lg:justify-end w-full lg:w-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <NeumorphicButton
            id="plan-my-day-btn"
            darkMode={darkMode}
            variant="primary"
            onClick={() => {
              setIsPlanning(true);
              handleGenerateProposedSchedule();
            }}
            className="py-3 px-5 text-sm flex items-center gap-1.5 hover:scale-[1.04] transition-all duration-300 ease-out flex-shrink-0"
          >
            <Sparkles className="w-4 h-4 text-white flex-shrink-0" />
            Plan My Day
          </NeumorphicButton>
          {onPrioritizeAll && (
            <NeumorphicButton
              id="re-prioritize-dashboard-btn"
              darkMode={darkMode}
              onClick={onPrioritizeAll}
              disabled={isPrioritizing}
              className="py-3 px-4 text-sm flex items-center gap-1.5 flex-shrink-0"
            >
              <Sparkles className={`w-4 h-4 text-indigo-500 flex-shrink-0 ${isPrioritizing ? 'animate-spin' : ''}`} />
              {isPrioritizing ? 'AI Prioritizing...' : 'Re-prioritize now'}
            </NeumorphicButton>
          )}
          {onTriggerAutonomous && (
            <NeumorphicButton
              id="autonomous-audit-btn"
              darkMode={darkMode}
              onClick={onTriggerAutonomous}
              disabled={isAutonomousProcessing}
              className="py-3 px-4 text-sm flex items-center gap-1.5 flex-shrink-0"
            >
              <Sparkles className={`w-4 h-4 text-emerald-500 flex-shrink-0 ${isAutonomousProcessing ? 'animate-spin' : ''}`} />
              {isAutonomousProcessing ? 'Agent Auditing...' : 'Run AI Agent Audit'}
            </NeumorphicButton>
          )}
          {hasRecentScheduleAction && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex-shrink-0">
              <NeumorphicButton
                id="undo-schedule-btn"
                darkMode={darkMode}
                variant="danger"
                onClick={onUndoSchedule}
                className="py-2.5 px-4 text-sm flex-shrink-0"
              >
                <Undo2 className="w-4 h-4 flex-shrink-0" />
                Undo AI Plan
              </NeumorphicButton>
            </motion.div>
          )}
          <NeumorphicButton
            id="auto-schedule-btn"
            darkMode={darkMode}
            variant="primary"
            onClick={onAutoSchedule}
            className="py-3 px-5 text-sm flex-shrink-0 flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4 text-white fill-white flex-shrink-0 animate-pulse" />
            Auto-Schedule My Tasks
          </NeumorphicButton>
        </div>
      </div>

      {isLocalMode && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center gap-3 shadow-inner"
        >
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Local Sandbox Mode Enabled:</span> Your database has safely fallen back to high-performance local storage. To activate full cloud database synchronization for this mode, please enable the <span className="font-bold font-mono">Email/Password</span> sign-in provider in your <a href="https://console.firebase.google.com/project/gen-lang-client-0503279257/authentication/providers" target="_blank" rel="noreferrer" className="underline font-bold hover:text-amber-800 dark:hover:text-amber-300">Firebase Console</a>. Alternatively, you can log in with Google to use the database instantly.
          </div>
        </motion.div>
      )}

      {/* Planner Command Center Header Widget: Analog Clock & Monthly Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Analog Clock Widget */}
        <NeumorphicContainer darkMode={darkMode} className="p-6 flex flex-col items-center justify-center relative min-h-[220px]" rounded="3xl">
          {/* Neumorphic Clock Outer Face */}
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.8)] dark:shadow-[6px_6px_12px_rgba(0,0,0,0.35),-6px_-6px_12px_rgba(255,255,255,0.03)] bg-[#e6ebf2] dark:bg-[#1a1d24] flex items-center justify-center relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.7)] dark:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.02)] bg-[#e6ebf2] dark:bg-[#1a1d24] relative flex items-center justify-center">
              {/* Hour, Minute, Second Hands */}
              <div 
                className="absolute w-1 h-7 bg-gray-800 dark:bg-gray-200 rounded-full origin-bottom"
                style={{ 
                  bottom: '50%', 
                  left: 'calc(50% - 2px)', 
                  transform: `rotate(${hrDeg}deg)`, 
                  transition: 'transform 0.5s cubic-bezier(0.4, 2.08, 0.55, 1)' 
                }}
              />
              <div 
                className="absolute w-[3px] h-9 bg-gray-600 dark:bg-gray-400 rounded-full origin-bottom"
                style={{ 
                  bottom: '50%', 
                  left: 'calc(50% - 1.5px)', 
                  transform: `rotate(${minDeg}deg)`,
                  transition: 'transform 0.5s cubic-bezier(0.4, 2.08, 0.55, 1)'
                }}
              />
              <div 
                className="absolute w-[1.5px] h-10 bg-indigo-500 rounded-full origin-bottom"
                style={{ 
                  bottom: '50%', 
                  left: 'calc(50% - 0.75px)', 
                  transform: `rotate(${secDeg}deg)`
                }}
              />
              {/* Center Pin */}
              <div className="absolute w-2.5 h-2.5 rounded-full bg-indigo-500 border border-[#e6ebf2] dark:border-[#1a1d24] shadow-sm z-10" />
            </div>
          </div>
          
          {/* Current Date Details */}
          <div className="text-center mt-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono">
              {time.toLocaleDateString(undefined, { weekday: 'long' })}
            </span>
            <h4 className="text-lg font-extrabold text-gray-900 dark:text-white leading-tight">
              {time.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </h4>
            <p className="text-xs font-mono font-bold text-indigo-500 bg-indigo-500/5 px-2.5 py-1 rounded-full inline-block mt-1">
              {time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </p>
          </div>
        </NeumorphicContainer>

        {/* Mini Month Calendar Grid Widget */}
        <NeumorphicContainer darkMode={darkMode} className="p-6 md:col-span-2 flex flex-col justify-between" rounded="3xl">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-800/40 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">
                {currentMonthName} {currentYear}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <NeumorphicButton
                id="prev-mini-month-btn"
                darkMode={darkMode}
                onClick={() => {
                  const prev = new Date(miniCalendarDate);
                  prev.setMonth(prev.getMonth() - 1);
                  setMiniCalendarDate(prev);
                }}
                className="p-1.5 rounded-lg text-gray-500"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </NeumorphicButton>
              <NeumorphicButton
                id="today-mini-month-btn"
                darkMode={darkMode}
                onClick={() => setMiniCalendarDate(new Date())}
                className="py-1 px-2.5 text-[10px] rounded-lg font-bold"
              >
                Today
              </NeumorphicButton>
              <NeumorphicButton
                id="next-mini-month-btn"
                darkMode={darkMode}
                onClick={() => {
                  const next = new Date(miniCalendarDate);
                  next.setMonth(next.getMonth() + 1);
                  setMiniCalendarDate(next);
                }}
                className="p-1.5 rounded-lg text-gray-500"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </NeumorphicButton>
            </div>
          </div>

          {/* Calendar Weekdays */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 font-mono uppercase">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1.5 flex-1">
            {getMonthGrid().map((dayNum, idx) => {
              if (dayNum === null) {
                return <div key={`empty-${idx}`} />;
              }

              const isTodayCell = 
                dayNum === new Date().getDate() && 
                miniCalendarDate.getMonth() === new Date().getMonth() && 
                miniCalendarDate.getFullYear() === new Date().getFullYear();

              const hasDeadlineCell = deadlineDaysSet.has(dayNum);

              // Find associated tasks for hover details / tooltips
              const daysTasks = tasks.filter(t => {
                if (!t.deadline || t.status === 'done') return false;
                const dt = new Date(t.deadline);
                return dt.getDate() === dayNum && 
                       dt.getMonth() === miniCalendarDate.getMonth() && 
                       dt.getFullYear() === miniCalendarDate.getFullYear();
              });

              return (
                <div
                  key={`day-${miniCalendarDate.getFullYear()}-${miniCalendarDate.getMonth()}-${dayNum}`}
                  className="relative group/day cursor-pointer flex flex-col items-center justify-center"
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                      isTodayCell
                        ? 'bg-indigo-500 text-white font-black shadow-md scale-105'
                        : hasDeadlineCell
                        ? 'bg-indigo-500/15 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-500/10'
                    }`}
                  >
                    {dayNum}
                  </div>
                  
                  {/* Show tiny dot below day number if it has any deadlines */}
                  {hasDeadlineCell && !isTodayCell && (
                    <span className="absolute bottom-0.5 w-1 h-1 bg-indigo-500 rounded-full" />
                  )}

                  {/* Hover Tooltip showing deadline tasks */}
                  {daysTasks.length > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/day:block z-30 w-52 p-2.5 text-[11px] leading-relaxed font-sans text-gray-700 dark:text-gray-200 bg-white dark:bg-[#202530] rounded-xl shadow-md border border-gray-150 dark:border-gray-800 pointer-events-none transition-all duration-200 normal-case text-left">
                      <div className="font-bold text-indigo-500 dark:text-indigo-400 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Deadlines ({daysTasks.length}):
                      </div>
                      <ul className="list-disc pl-3 space-y-1">
                        {daysTasks.map(t => (
                          <li key={t.id} className="font-medium text-gray-600 dark:text-gray-300 truncate font-sans">
                            {t.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </NeumorphicContainer>
      </div>

      {/* Personalized Productivity Recommendations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-indigo-500" />
            Personalized Recommendations
          </h3>
          <NeumorphicButton
            id="refresh-insights-btn"
            darkMode={darkMode}
            onClick={onRefreshRecommendations}
            disabled={isRefreshingRecommendations}
            className="py-1.5 px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isRefreshingRecommendations ? 'animate-spin' : ''}`} />
            Refresh insights
          </NeumorphicButton>
        </div>

        {recommendations.filter(r => !r.dismissed).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {recommendations.filter(r => !r.dismissed).map((rec) => {
                // Determine icon based on category
                let IconComponent = Lightbulb;
                let borderThemeColor = "border-indigo-500/10";
                let bgThemeColor = "bg-indigo-500/5";
                let textThemeColor = "text-indigo-500";
                
                if (rec.category === 'focus_time') {
                  IconComponent = Clock;
                  borderThemeColor = "border-blue-500/10";
                  bgThemeColor = "bg-blue-500/5";
                  textThemeColor = "text-blue-500";
                } else if (rec.category === 'procrastination') {
                  IconComponent = AlertTriangle;
                  borderThemeColor = "border-amber-500/10";
                  bgThemeColor = "bg-amber-500/5";
                  textThemeColor = "text-amber-500";
                } else if (rec.category === 'habit_risk') {
                  IconComponent = Zap;
                  borderThemeColor = "border-rose-500/10";
                  bgThemeColor = "bg-rose-500/5";
                  textThemeColor = "text-rose-500";
                }

                return (
                  <motion.div
                    key={rec.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -15 }}
                    transition={{ duration: 0.3 }}
                  >
                    <NeumorphicContainer
                      darkMode={darkMode}
                      className="p-5 flex flex-col justify-between h-full relative border border-gray-100/5 shadow-sm"
                      rounded="2xl"
                    >
                      {/* Dismiss button */}
                      <button
                        onClick={() => onDismissRecommendation && onDismissRecommendation(rec.id)}
                        className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none"
                        aria-label="Dismiss recommendation"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="space-y-3 pr-6">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${borderThemeColor} ${bgThemeColor}`}>
                          <IconComponent className={`w-5 h-5 ${textThemeColor}`} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-gray-800 dark:text-white leading-snug">
                            {rec.title}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-sans">
                            {rec.message}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100/10 flex justify-between items-center">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${textThemeColor}`}>
                          {rec.category.replace('_', ' ')}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono">
                          {new Date(rec.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </NeumorphicContainer>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <NeumorphicContainer
            darkMode={darkMode}
            className="p-8 text-center flex flex-col items-center justify-center space-y-4 border border-gray-100/5"
            rounded="2xl"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Award className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-bold text-gray-800 dark:text-white">All caught up!</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                No active recommendations. Click "Refresh insights" to run a fresh 14-day analysis of your completed/missed tasks, habit streaks, and goal progress.
              </p>
            </div>
            <NeumorphicButton
              id="generate-recommendations-empty-btn"
              darkMode={darkMode}
              onClick={onRefreshRecommendations}
              disabled={isRefreshingRecommendations}
              className="py-2 px-4 text-xs"
            >
              {isRefreshingRecommendations ? 'Analyzing activity...' : 'Generate recommendations'}
            </NeumorphicButton>
          </NeumorphicContainer>
        )}
      </div>

      {/* AI Action Alert / Toast Integration */}
      <AnimatePresence>
        {hasRecentScheduleAction && recentActionExplanation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6"
          >
            <NeumorphicContainer
              darkMode={darkMode}
              className="p-5 border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden"
              rounded="2xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
              <div className="flex gap-3 relative z-10">
                <Sparkles className="w-6 h-6 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    AI Auto-Scheduler Completed
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {recentActionExplanation}
                  </p>
                  <div className="text-xs text-indigo-500 dark:text-indigo-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active in Calendar. You can cancel or alter any block in Settings or click Undo above.
                  </div>
                </div>
              </div>
            </NeumorphicContainer>
          </motion.div>
        )}

        {hasAutonomousAction && autonomousActionExplanation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6"
          >
            <NeumorphicContainer
              darkMode={darkMode}
              className="p-5 border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden"
              rounded="2xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
              <div className="flex gap-4 relative z-10 w-full">
                <Sparkles className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-3 w-full">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      Pulse Autonomous Agent Optimization Completed
                    </h4>
                    {onDismissAutonomous && (
                      <button 
                        onClick={onDismissAutonomous}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-medium cursor-pointer"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {autonomousActionExplanation}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Optimizations applied. Revert any time using Undo.
                    </div>
                    {onUndoAutonomous && (
                      <NeumorphicButton
                        id="undo-autonomous-btn"
                        darkMode={darkMode}
                        variant="danger"
                        onClick={onUndoAutonomous}
                        className="py-1.5 px-3.5 text-xs flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Undo Changes
                      </NeumorphicButton>
                    )}
                  </div>
                </div>
              </div>
            </NeumorphicContainer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7-Day Productivity & Habit Completion Analytics */}
      <NeumorphicContainer darkMode={darkMode} className="p-6 sm:p-8 flex flex-col relative mb-8" rounded="3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                7-Day Productivity & Habit Analytics
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Live granular tracking of task completions and daily habit routines.
            </p>
          </div>
          
          {/* Stats Badges Row with inset surface shadow depth */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase tracking-wider font-bold">
                Weekly Rate
              </span>
              <NeumorphicContainer darkMode={darkMode} inset={true} className="px-3 py-1.5 mt-1 text-center font-mono text-sm sm:text-base font-extrabold text-indigo-500 dark:text-indigo-400" rounded="lg">
                {averageWeeklyRate}%
              </NeumorphicContainer>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase tracking-wider font-bold">
                Tasks Done
              </span>
              <NeumorphicContainer darkMode={darkMode} inset={true} className="px-3 py-1.5 mt-1 text-center font-mono text-sm sm:text-base font-extrabold text-teal-600 dark:text-teal-400" rounded="lg">
                {totalTasksCompletedThisWeek}
              </NeumorphicContainer>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase tracking-wider font-bold">
                Habits Done
              </span>
              <NeumorphicContainer darkMode={darkMode} inset={true} className="px-3 py-1.5 mt-1 text-center font-mono text-sm sm:text-base font-extrabold text-[#6366f1]" rounded="lg">
                {totalHabitsCompletedThisWeek}
              </NeumorphicContainer>
            </div>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={darkMode ? '#262b34' : '#d1dbe8'} 
                vertical={false}
              />
              <XAxis 
                dataKey="label" 
                stroke={darkMode ? '#9ca3af' : '#4b5563'} 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke={darkMode ? '#9ca3af' : '#4b5563'} 
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)' }} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
              />
              <Bar 
                name="Completed Tasks" 
                dataKey="completedTasks" 
                fill="#0d9488" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={30}
              />
              <Bar 
                name="Completed Habits" 
                dataKey="completedHabits" 
                fill="#6366f1" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </NeumorphicContainer>

      {/* Grid Layout: Countdown & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Countdown timer & Deadlines */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <NeumorphicContainer darkMode={darkMode} className="p-4 sm:p-6 flex flex-col justify-between relative" rounded="3xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono">
                    Nearest Priority Focus
                  </h3>
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium font-sans mt-0.5">
                    Weighed by Priority & Urgency
                  </span>
                </div>
                <Hourglass className="w-5 h-5 text-indigo-500" />
              </div>

              {nearestTask ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight line-clamp-1">
                      {nearestTask.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Category: {nearestTask.category || 'General'} • Priority: {nearestTask.priorityScore}/100
                      </p>
                      {nearestTask.priorityReason && (
                        <div className="relative group/reason">
                          <div className="flex items-center gap-1 text-[10px] font-medium bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded-full cursor-help hover:bg-indigo-500/20 transition-all">
                            <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                            <span>AI Insight</span>
                          </div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/reason:block group-focus/reason:block z-30 w-64 p-2.5 text-[11px] leading-relaxed font-sans text-gray-700 dark:text-gray-200 bg-white dark:bg-[#202530] rounded-xl shadow-md border border-gray-100 dark:border-gray-800 pointer-events-none transition-all duration-200">
                            <div className="font-bold text-indigo-500 dark:text-indigo-400 mb-0.5 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              AI Prioritization Reasoning:
                            </div>
                            <p className="font-medium text-gray-600 dark:text-gray-300">{nearestTask.priorityReason}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {nearestTask.priorityReason && (
                    <div className="p-3 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/20 flex items-start gap-2.5 text-left">
                      <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider block">AI Priority Advice</span>
                        <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed mt-0.5">{nearestTask.priorityReason}</p>
                      </div>
                    </div>
                  )}

                  {timeLeft ? (
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center py-4">
                      <div className="space-y-1">
                        <NeumorphicContainer darkMode={darkMode} inset={true} className="py-2 sm:py-3 font-mono text-base sm:text-xl font-extrabold text-indigo-500 dark:text-indigo-400" rounded="xl">
                          {timeLeft.days.toString().padStart(2, '0')}
                        </NeumorphicContainer>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Days</span>
                      </div>
                      <div className="space-y-1">
                        <NeumorphicContainer darkMode={darkMode} inset={true} className="py-2 sm:py-3 font-mono text-base sm:text-xl font-extrabold text-indigo-500 dark:text-indigo-400" rounded="xl">
                          {timeLeft.hours.toString().padStart(2, '0')}
                        </NeumorphicContainer>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Hrs</span>
                      </div>
                      <div className="space-y-1">
                        <NeumorphicContainer darkMode={darkMode} inset={true} className="py-2 sm:py-3 font-mono text-base sm:text-xl font-extrabold text-indigo-500 dark:text-indigo-400" rounded="xl">
                          {timeLeft.minutes.toString().padStart(2, '0')}
                        </NeumorphicContainer>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Mins</span>
                      </div>
                      <div className="space-y-1">
                        <NeumorphicContainer darkMode={darkMode} inset={true} className="py-2 sm:py-3 font-mono text-base sm:text-xl font-extrabold text-indigo-500 dark:text-indigo-400" rounded="xl">
                          {timeLeft.seconds.toString().padStart(2, '0')}
                        </NeumorphicContainer>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Secs</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">Loading countdown...</div>
                  )}

                  <div className="pt-2">
                    <NeumorphicButton
                      id="focus-nearest-task-btn"
                      darkMode={darkMode}
                      variant="secondary"
                      onClick={() => onNavigate('tasks')}
                      className="w-full text-xs py-2.5 flex items-center justify-center gap-1.5"
                    >
                      <span>Task Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </NeumorphicButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                    <CheckCircle2 className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All caught up!</h4>
                    <p className="text-xs text-gray-400 max-w-[200px]">No upcoming deadlines. Go ahead and relax!</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 border-t border-gray-100 dark:border-gray-800/40 pt-4">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-sans">
                💡 Deadlines auto-generate desktop and audio notification alerts.
              </span>
            </div>
          </NeumorphicContainer>

          {/* Next Chronological Deadline Container (Distinct from Nearest Priority Focus) */}
          <NeumorphicContainer darkMode={darkMode} className="p-4 sm:p-5 flex flex-col relative" rounded="3xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-rose-500 dark:text-rose-400" /> Next Chronological Deadline
                </h3>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium font-sans mt-0.5">
                  Absolutely Closest Deadline in Time
                </span>
              </div>
              {chronologicalNearestTask && nearestTask && chronologicalNearestTask.id === nearestTask.id && (
                <span className="text-[9px] font-mono font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  Top Priority Focus
                </span>
              )}
            </div>

            {chronologicalNearestTask ? (
              <div 
                onClick={() => onNavigate('tasks')}
                className="group cursor-pointer p-3.5 rounded-2xl bg-gray-500/5 dark:bg-gray-500/10 border border-transparent hover:border-gray-100 dark:hover:border-gray-800/40 hover:bg-gray-500/10 dark:hover:bg-gray-500/15 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors truncate">
                      {chronologicalNearestTask.title}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-1">
                      Category: {chronologicalNearestTask.category || 'General'}
                    </p>
                    <p className="text-xs text-rose-500 dark:text-rose-400 font-bold mt-1.5 flex items-center gap-1">
                      <Hourglass className="w-3.5 h-3.5 animate-pulse" />
                      {formatTimeRemaining(chronologicalNearestTask.deadline)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityBadgeClass(chronologicalNearestTask.priorityScore)}`}>
                      {getPriorityLabelText(chronologicalNearestTask.priorityScore)} Priority
                    </span>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                      Score: {chronologicalNearestTask.priorityScore}/100
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No upcoming deadlines.</p>
            )}
          </NeumorphicContainer>

          {/* Upcoming Deadlines Container */}
          <NeumorphicContainer darkMode={darkMode} className="p-4 sm:p-5 flex flex-col relative" rounded="3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" /> Other Upcoming Deadlines
              </h3>
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full">
                {upcomingTasks.length} tasks
              </span>
            </div>

            {upcomingTasks.length > 0 ? (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onNavigate('tasks')}
                    className="group cursor-pointer p-3 rounded-2xl hover:bg-gray-500/5 dark:hover:bg-gray-500/10 border border-transparent hover:border-gray-100 dark:hover:border-gray-800/40 transition-all duration-300 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {task.title}
                      </h4>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                        {formatTimeRemaining(task.deadline)}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityBadgeClass(task.priorityScore)}`}>
                        {getPriorityLabelText(task.priorityScore)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                <p className="text-xs text-gray-400 dark:text-gray-500">No other upcoming deadlines.</p>
              </div>
            )}
          </NeumorphicContainer>
        </div>

        {/* Right Column: AI Insight & Today's Plan strip */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <NeumorphicContainer darkMode={darkMode} className="p-4 sm:p-6 flex flex-col justify-between relative" rounded="3xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                  <Sparkles className={`w-4 h-4 text-amber-500 ${isFetchingInsight ? 'animate-spin' : ''}`} /> Pulse Companion Insight
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualRefreshInsight}
                    disabled={isFetchingInsight}
                    className={`p-1.5 rounded-full hover:bg-gray-500/5 dark:hover:bg-gray-500/10 text-gray-400 dark:text-gray-500 transition-colors ${
                      isFetchingInsight ? 'animate-spin text-indigo-500' : ''
                    }`}
                    title="Refresh AI Insights"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    aiInsight.priority === 'high' 
                      ? 'bg-amber-500/10 text-amber-500' 
                      : aiInsight.priority === 'medium'
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'bg-green-500/10 text-green-500'
                  }`}>
                    {aiInsight.priority} Priority
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {aiInsight.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-sans">
                  {aiInsight.message}
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200">Autonomous Milestones Triggered</h5>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                  Pulse tracks goals automatically. If milestones fall behind schedule, we recalculate target milestones and trigger active warnings in your planner.
                </p>
              </div>
            </div>
          </NeumorphicContainer>

          {/* Today's Plan strip inside right column to prevent stretch */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                Today's Plan Strip
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>

            <NeumorphicContainer darkMode={darkMode} className="p-4 sm:p-6" rounded="3xl">
              {todayBlocks.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-indigo-500/20 space-y-6">
                  {todayBlocks.map((block, index) => {
                    const task = getTaskForBlock(block.taskId);
                    return (
                      <motion.div 
                        key={block.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative"
                      >
                        {/* Circle timeline bullet */}
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-indigo-500 border-4 border-[#e6ebf2] dark:border-[#1a1d24] z-10 shadow-sm" />
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-gray-500/5 rounded-xl transition-all duration-300 min-w-0">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <span className="text-xs font-mono font-bold bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded-md h-fit whitespace-nowrap">
                              {formatBlockTime(block.start)} - {formatBlockTime(block.end)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 hover:underline cursor-pointer truncate flex items-center gap-1" onClick={() => onNavigate('tasks')}>
                                {task ? task.title : 'Unlinked Focus Session'}
                                {task && task.priorityReason && (
                                  <span className="relative group/reason inline-block">
                                    <span className="cursor-help inline-flex items-center text-[10px] font-medium text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                      <Sparkles className="w-2.5 h-2.5 mr-0.5" /> AI
                                    </span>
                                    {/* Tooltip */}
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/reason:block group-focus/reason:block z-30 w-64 p-2.5 text-[11px] leading-relaxed font-sans text-gray-700 dark:text-gray-200 bg-white dark:bg-[#202530] rounded-xl shadow-md border border-gray-100 dark:border-gray-800 pointer-events-none normal-case">
                                      <span className="font-bold text-indigo-500 dark:text-indigo-400 mb-0.5 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        AI Prioritization Reasoning:
                                      </span>
                                      <span className="font-medium text-gray-600 dark:text-gray-300 block">{task.priorityReason}</span>
                                    </span>
                                  </span>
                                )}
                              </h4>
                              <p className={`text-xs text-gray-400 dark:text-gray-500 mt-0.5 ${expandedBlocks[block.id] ? '' : 'line-clamp-1'}`}>
                                {task?.description || 'Allocated block for peak-efficiency concentration.'}
                              </p>
                              {task && task.priorityReason && !expandedBlocks[block.id] && (
                                <p className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-1.5 flex items-start gap-1 leading-normal font-medium">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5 animate-pulse" />
                                  <span>AI Advice: {task.priorityReason}</span>
                                </p>
                              )}

                              <AnimatePresence>
                                {expandedBlocks[block.id] && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/40 space-y-2 text-[11px] text-gray-500 dark:text-gray-400 font-sans"
                                  >
                                    <div className="flex justify-between items-center bg-gray-500/5 dark:bg-gray-500/10 p-1.5 rounded-lg">
                                      <span className="font-semibold text-gray-600 dark:text-gray-400">Created At:</span>
                                      <span className="font-mono text-gray-700 dark:text-gray-300">
                                        {task?.createdAt ? new Date(task.createdAt).toLocaleString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: false
                                        }) : 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-500/5 dark:bg-gray-500/10 p-1.5 rounded-lg">
                                      <span className="font-semibold text-gray-600 dark:text-gray-400">Category / Status:</span>
                                      <span className="text-gray-700 dark:text-gray-300 capitalize">{task?.category || 'General'} • {task?.status || 'Active'}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-500/5 dark:bg-gray-500/10 p-1.5 rounded-lg">
                                      <span className="font-semibold text-gray-600 dark:text-gray-400">Time Duration:</span>
                                      <span className="text-gray-700 dark:text-gray-300 font-mono">
                                        {new Date(block.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} to {new Date(block.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                      </span>
                                    </div>
                                    {task?.priorityReason && (
                                      <div className="bg-indigo-500/5 dark:bg-indigo-500/10 p-2.5 rounded-lg border border-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                        <span className="font-bold block mb-1 text-[10px] uppercase font-mono flex items-center gap-1">
                                          <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Priority Reasoning
                                        </span>
                                        <p className="leading-relaxed font-sans text-xs text-gray-700 dark:text-gray-300">{task.priorityReason}</p>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-2 sm:pl-0 flex-shrink-0">
                            <button
                              id={`expand-block-${block.id}`}
                              onClick={() => toggleExpandBlock(block.id)}
                              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                expandedBlocks[block.id]
                                  ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold'
                                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                              }`}
                            >
                              <span>{expandedBlocks[block.id] ? 'Hide' : 'Details'}</span>
                              {expandedBlocks[block.id] ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {task && (
                              <button
                                id={`complete-block-task-${block.id}`}
                                onClick={() => {
                                  if (task.status !== 'done') {
                                    onCompleteTask(task.id, true);
                                  }
                                }}
                                disabled={task.status === 'done'}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                                  task.status === 'done'
                                    ? 'bg-green-500/10 border-green-500/20 text-green-500 opacity-80 cursor-not-allowed'
                                    : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 cursor-pointer'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {task.status === 'done' ? 'Completed' : 'Complete Task'}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40">
                    <Calendar className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300">No scheduled focus blocks for today</h4>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      Let Pulse auto-schedule your high-priority items based on your set working hours and deadlines.
                    </p>
                  </div>
                  <NeumorphicButton
                    id="auto-schedule-empty-btn"
                    darkMode={darkMode}
                    variant="primary"
                    onClick={onAutoSchedule}
                    className="text-xs py-2 px-4"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    Auto-Schedule Focus Blocks
                  </NeumorphicButton>
                </div>
              )}
            </NeumorphicContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
