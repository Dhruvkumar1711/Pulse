import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  X, 
  Volume2, 
  Loader2, 
  RotateCcw, 
  CheckCircle, 
  Sparkles, 
  AlertCircle,
  Clock,
  Trash2,
  Send
} from 'lucide-react';
import { NeumorphicContainer, NeumorphicButton, NeumorphicInput } from './Neumorphic';
import { Task } from '../types';

interface VoiceAssistantProps {
  darkMode: boolean;
  tasks: Task[];
  onAddTask: (taskData: any) => Promise<void>;
  onUpdateTask: (id: string, updates: any) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  habits?: any[];
  goals?: any[];
  onAddHabit?: (habitData: any) => Promise<void>;
  onCompleteHabit?: (id: string) => Promise<void>;
  onAddGoal?: (goalData: any, aiBreakdown?: boolean) => Promise<void>;
  onDeleteHabit?: (id: string) => Promise<void>;
  onDeleteGoal?: (id: string) => Promise<void>;
  onClearAllReminders?: () => Promise<void>;
  showNotification?: (message: string, type: 'error' | 'success' | 'info') => void;
  userId?: string;
}

interface VoiceHistoryItem {
  sender: 'user' | 'pulse';
  text: string;
  actionTaken?: {
    type: string;
    description: string;
    undoData: any;
  };
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  darkMode,
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  habits = [],
  goals = [],
  onAddHabit,
  onCompleteHabit,
  onAddGoal,
  onDeleteHabit,
  onDeleteGoal,
  onClearAllReminders,
  showNotification,
  userId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<VoiceHistoryItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [confirmDeletions, setConfirmDeletions] = useState<boolean>(() => {
    const saved = localStorage.getItem('pulse_confirm_voice_deletions');
    return saved !== null ? saved === 'true' : true;
  });
  const [pendingAction, setPendingAction] = useState<{
    type: string;
    params: any;
    description: string;
    textResponse: string;
    speechAudio?: string;
  } | null>(null);

  const handleToggleConfirmDeletions = () => {
    const newValue = !confirmDeletions;
    setConfirmDeletions(newValue);
    localStorage.setItem('pulse_confirm_voice_deletions', String(newValue));
    if (showNotification) {
      showNotification(`Voice action confirmations ${newValue ? 'enabled' : 'disabled'}.`, 'info');
    }
  };

  const statusRef = useRef(status);
  const transcriptRef = useRef(transcript);
  const latestTranscriptRef = useRef('');
  const handleVoiceCommandRef = useRef<(text: string) => Promise<void>>(null as any);
  const silenceTimeoutRef = useRef<any>(null);

  // Sync state to refs
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = 'en-US';
      rec.interimResults = true;

      rec.onstart = () => {
        setStatus('listening');
        setTranscript('Listening...');
        latestTranscriptRef.current = '';
        setErrorMsg('');

        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        // General fallback timeout if no speech detected at all after 8 seconds
        silenceTimeoutRef.current = setTimeout(() => {
          if (statusRef.current === 'listening' && (latestTranscriptRef.current === '' || latestTranscriptRef.current === 'Listening...')) {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop();
              } catch (e) {}
            }
          }
        }, 8000);
      };

      rec.onresult = (event: any) => {
        const currentResult = event.results[event.results.length - 1];
        const text = currentResult[0].transcript;
        setTranscript(text);
        latestTranscriptRef.current = text;

        // Reset silence detection timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        if (text && text.trim() && text !== 'Listening...') {
          silenceTimeoutRef.current = setTimeout(() => {
            console.log('Silence detected, auto-submitting voice command...');
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop();
              } catch (e) {}
            }
          }, 1600); // 1.6 seconds of silence to auto-submit
        }
      };

      rec.onerror = (event: any) => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        if (event.error === 'aborted') {
          // Keep it clean if manually aborted
          setStatus('idle');
          setErrorMsg('');
          return;
        }

        console.warn('Speech recognition warning:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone permission denied. Please allow microphone access in your browser\'s site settings (usually by clicking the lock/settings icon next to the URL in the address bar).');
        } else if (event.error === 'audio-capture') {
          setErrorMsg('No working microphone detected. Please check that your device\'s microphone is plugged in, enabled in your OS settings, and allowed by the browser, or use the "Type task command..." input field instead.');
        } else if (event.error === 'network') {
          setErrorMsg('Browser speech service connection issue (Network). Feel free to type your command in the input box above instead!');
        } else if (event.error === 'no-speech') {
          setErrorMsg('No speech was detected. Please try speaking again or type your command.');
        } else {
          setErrorMsg(`Voice issue: ${event.error || 'Could not capture your voice'}. Please try again, or use the "Type task command..." input field instead!`);
        }
        setStatus('error');
      };

      rec.onend = () => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        // Automatically process the captured text once user stops speaking
        if (statusRef.current === 'listening') {
          const finalCommand = latestTranscriptRef.current.trim();
          if (finalCommand && finalCommand !== 'Listening...') {
            if (handleVoiceCommandRef.current) {
              handleVoiceCommandRef.current(finalCommand);
            }
          } else {
            setStatus('idle');
          }
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      stopAudioPlayback();
    };
  }, []);

  // Auto-scroll conversational history to bottom
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isOpen, status]);

  const startListening = async () => {
    stopAudioPlayback();
    setTranscript('');
    setResponse('');
    setErrorMsg('');
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (!recognitionRef.current) {
      setErrorMsg('Microphone input is not supported in this browser, but you can still type commands below!');
      setStatus('error');
      return;
    }

    // Explicitly request microphone permission on start to get a clear prompt with context
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        setStatus('processing');
        setTranscript('Requesting microphone access...');
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release the microphone stream immediately so SpeechRecognition can capture it
        stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
        console.error('Microphone permission/capture error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMsg('Microphone permission denied. Please allow microphone access in your browser\'s site settings (usually by clicking the lock/settings icon next to the URL in the address bar).');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.name === 'OverconstrainedError') {
          setErrorMsg('No working microphone detected. Please check that your device\'s microphone is plugged in, enabled in your OS settings, and allowed by the browser, or use the "Type task command..." input field instead.');
        } else {
          setErrorMsg(`Microphone error: ${err.message || 'Could not access audio stream'}. Please check your mic settings or use the text input below.`);
        }
        setStatus('error');
        return;
      }
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn('Recognition already started or error starting:', e);
    }
  };

  const stopListening = async () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Error stopping recognition:', e);
      }
    }
  };

  const handleToggleMic = () => {
    if (status === 'listening') {
      stopListening();
    } else {
      setIsOpen(true);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        startListening();
      } else {
        setStatus('idle');
        setErrorMsg('Microphone input is not supported in this browser, but you can still type commands below!');
      }
    }
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    setStatus('processing');
    const { type, params } = pendingAction;
    
    try {
      const t = type.toLowerCase();
      let actDesc = '';
      if (t === 'deletegoal' || t === 'delete_goal') {
        const goal = goals.find(g => g.id === params.goalId);
        actDesc = `Deleted goal "${goal ? goal.title : 'goal'}"`;
        if (onDeleteGoal) {
          await onDeleteGoal(params.goalId);
        }
      } else if (t === 'clearreminders' || t === 'clear_reminders') {
        actDesc = `Cleared all active reminders`;
        if (onClearAllReminders) {
          await onClearAllReminders();
        }
      } else if (t === 'deletetask' || t === 'delete_task') {
        const task = tasks.find(taskItem => taskItem.id === params.taskId);
        actDesc = `Deleted task "${task ? task.title : 'task'}"`;
        await onDeleteTask(params.taskId);
      } else if (t === 'deletehabit' || t === 'delete_habit') {
        const habit = habits.find(h => h.id === params.habitId);
        actDesc = `Deleted habit "${habit ? habit.name : 'habit'}"`;
        if (onDeleteHabit) {
          await onDeleteHabit(params.habitId);
        }
      }

      setHistory(prev => [...prev, {
        sender: 'pulse',
        text: `Action confirmed. I have successfully ${actDesc.toLowerCase()}.`
      }]);

      if (showNotification) {
        showNotification(actDesc, 'success');
      }

      setPendingAction(null);
      setStatus('speaking');
      playBrowserVoice(`Confirmed. I have ${actDesc.toLowerCase()}.`);
    } catch (err) {
      console.error("Failed to execute pending action:", err);
      setErrorMsg("Failed to execute that action. Please try again.");
      setStatus('error');
    }
  };

  const handleCancelPendingAction = () => {
    if (!pendingAction) return;
    setPendingAction(null);
    setHistory(prev => [...prev, {
      sender: 'pulse',
      text: "Action cancelled. Deletion was aborted."
    }]);
    setStatus('speaking');
    playBrowserVoice("Cancelled. Deletion aborted.");
  };

  const handleVoiceCommand = async (commandText: string) => {
    setStatus('processing');
    
    // Add User query to history
    setHistory(prev => [...prev, { sender: 'user', text: commandText }]);

    // Check if waiting for confirmation
    if (pendingAction) {
      const normalized = commandText.toLowerCase().trim();
      const isConfirm = normalized === 'yes' || normalized === 'y' || normalized === 'confirm' || normalized === 'sure' || normalized === 'yes please' || normalized === 'do it' || normalized === 'ok' || normalized === 'okay' || normalized.includes('confirm') || normalized.includes('yes');
      const isCancel = normalized === 'no' || normalized === 'n' || normalized === 'cancel' || normalized === 'stop' || normalized === 'no way' || normalized.includes('cancel') || normalized.includes('no');

      if (isConfirm) {
        await executePendingAction();
        return;
      } else if (isCancel) {
        handleCancelPendingAction();
        return;
      } else {
        const repText = `I didn't quite catch your confirmation. Would you like to proceed with: "${pendingAction.description}"? Please say 'yes' to confirm or 'no' to cancel.`;
        setHistory(prev => [...prev, { sender: 'pulse', text: repText }]);
        setStatus('speaking');
        playBrowserVoice(repText);
        return;
      }
    }

    try {
      const res = await fetch('/api/voice/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: commandText,
          tasks,
          habits,
          goals,
          currentTime: new Date().toISOString(),
          userId
        })
      });

      const data = await res.json();
      if (data.success) {
        setResponse(data.textResponse);
        
        // Execute Action from Gemini function calling
        let actionDescription = '';
        let undoData: any = null;

        if (data.action) {
          const { type, params, executedOnServer } = data.action;
          
          const t = type.toLowerCase();
          const isHighImpact = t === 'deletegoal' || t === 'delete_goal' ||
                               t === 'clearreminders' || t === 'clear_reminders' ||
                               t === 'deletetask' || t === 'delete_task' ||
                               t === 'deletehabit' || t === 'delete_habit';

          if (isHighImpact && confirmDeletions) {
            let description = '';
            if (t === 'deletegoal' || t === 'delete_goal') {
              const goal = goals.find(g => g.id === params.goalId);
              description = `delete the goal "${goal ? goal.title : 'goal'}"`;
            } else if (t === 'clearreminders' || t === 'clear_reminders') {
              description = "clear all active reminders";
            } else if (t === 'deletetask' || t === 'delete_task') {
              const task = tasks.find(taskItem => taskItem.id === params.taskId);
              description = `delete the task "${task ? task.title : 'task'}"`;
            } else if (t === 'deletehabit' || t === 'delete_habit') {
              const habit = habits.find(h => h.id === params.habitId);
              description = `delete the habit "${habit ? habit.name : 'habit'}"`;
            }

            setPendingAction({
              type,
              params,
              description,
              textResponse: data.textResponse,
              speechAudio: data.speechAudio
            });

            const repText = `I received a request to delete. Are you sure you want to ${description}? Please say 'yes' or click Confirm to proceed, or say 'no' to cancel.`;
            setHistory(prev => [...prev, { sender: 'pulse', text: repText }]);
            setStatus('speaking');
            playBrowserVoice(`Are you sure you want to ${description}?`);
            return;
          }

          const isCreateTask = type === 'create_task' || type === 'createTask';
          const isUpdateTask = type === 'update_task' || type === 'updateTask';
          const isRescheduleTask = type === 'reschedule_task' || type === 'rescheduleTask';
          const isCreateHabit = type === 'create_habit' || type === 'createHabit';
          const isCompleteHabit = type === 'complete_habit' || type === 'completeHabit';
          const isCreateGoal = type === 'create_goal' || type === 'createGoal';
          const isDeleteGoal = type === 'delete_goal' || type === 'deleteGoal';
          const isClearReminders = type === 'clear_reminders' || type === 'clearReminders';
          const isDeleteTask = type === 'delete_task' || type === 'deleteTask';
          const isDeleteHabit = type === 'delete_habit' || type === 'deleteHabit';
          
          if (isCreateTask) {
            actionDescription = `Created task "${params.title}"`;
            undoData = { type: 'create_task', title: params.title };
            
            if (!executedOnServer) {
              const taskPayload = {
                title: params.title,
                description: params.description || 'Created via Voice Assistant',
                deadline: params.deadline || new Date().toISOString().split('T')[0],
                estimatedMinutes: Number(params.estimatedMinutes) || 30,
                category: params.category || 'General',
                status: params.status || 'todo',
                priorityScore: params.priorityScore || 50,
                priorityReason: 'Created via Pulse voice command.'
              };
              await onAddTask(taskPayload);
            }
          } else if (isUpdateTask) {
            const taskToUpdate = tasks.find(t => t.id === params.taskId);
            if (taskToUpdate) {
              const originalState = { ...taskToUpdate };
              actionDescription = `Updated task "${taskToUpdate.title}"`;
              undoData = { type: 'update_task', id: params.taskId, previous: originalState };

              if (!executedOnServer) {
                const updates: any = {};
                if (params.status) updates.status = params.status;
                if (params.title) updates.title = params.title;
                if (params.category) updates.category = params.category;
                if (params.priorityScore) updates.priorityScore = params.priorityScore;
                await onUpdateTask(params.taskId, updates);
              }
            }
          } else if (isRescheduleTask) {
            const taskToReschedule = tasks.find(t => t.id === params.taskId);
            if (taskToReschedule) {
              const originalState = { ...taskToReschedule };
              const targetDeadline = params.newDeadline || params.deadline;
              actionDescription = `Rescheduled task "${taskToReschedule.title}" to ${new Date(targetDeadline).toLocaleDateString()}`;
              undoData = { type: 'update_task', id: params.taskId, previous: originalState };

              if (!executedOnServer) {
                await onUpdateTask(params.taskId, { deadline: targetDeadline });
              }
            }
          } else if (isCreateHabit) {
            actionDescription = `Created habit "${params.name}"`;
            undoData = { type: 'create_habit', name: params.name };

            if (!executedOnServer && onAddHabit) {
              const habitPayload = {
                name: params.name,
                frequency: params.frequency || 'daily'
              };
              await onAddHabit(habitPayload);
            }
          } else if (isCompleteHabit) {
            const habit = habits.find(h => h.id === params.habitId);
            actionDescription = `Completed habit "${habit ? habit.name : 'habit'}"`;

            if (!executedOnServer && onCompleteHabit) {
              await onCompleteHabit(params.habitId);
            }
          } else if (isCreateGoal) {
            actionDescription = `Created goal "${params.title}"`;
            undoData = { type: 'create_goal', title: params.title };

            if (!executedOnServer && onAddGoal) {
              const targetDate = params.targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              await onAddGoal({
                title: params.title,
                targetDate,
                progressPercent: 0
              }, params.aiBreakdown !== false);
            }
          } else if (isDeleteGoal) {
            const goal = goals.find(g => g.id === params.goalId);
            actionDescription = `Deleted goal "${goal ? goal.title : 'goal'}"`;
            if (onDeleteGoal) {
              await onDeleteGoal(params.goalId);
            }
          } else if (isClearReminders) {
            actionDescription = `Cleared all active reminders`;
            if (onClearAllReminders) {
              await onClearAllReminders();
            }
          } else if (isDeleteTask) {
            const task = tasks.find(taskItem => taskItem.id === params.taskId);
            actionDescription = `Deleted task "${task ? task.title : 'task'}"`;
            await onDeleteTask(params.taskId);
          } else if (isDeleteHabit) {
            const habit = habits.find(h => h.id === params.habitId);
            actionDescription = `Deleted habit "${habit ? habit.name : 'habit'}"`;
            if (onDeleteHabit) {
              await onDeleteHabit(params.habitId);
            }
          }
        }

        // Add Assistant reply to history
        const historyItem: VoiceHistoryItem = { 
          sender: 'pulse', 
          text: data.textResponse 
        };

        if (actionDescription) {
          historyItem.actionTaken = {
            type: data.action.type,
            description: actionDescription,
            undoData
          };

          if (showNotification) {
            showNotification(actionDescription, 'success');
          }
        }

        setHistory(prev => [...prev, historyItem]);

        // Synthesize voice
        if (data.speechAudio) {
          setStatus('speaking');
          await playAudio(data.speechAudio);
        } else {
          setStatus('speaking');
          playBrowserVoice(data.textResponse);
        }
      } else {
        throw new Error(data.error || 'Failed to process command');
      }
    } catch (err: any) {
      console.error('Error processing voice command:', err);
      setErrorMsg('Oops! I encountered an issue. Let\'s try that again.');
      setStatus('error');
    }
  };

  useEffect(() => {
    handleVoiceCommandRef.current = handleVoiceCommand;
  }, [tasks, onAddTask, onUpdateTask, onDeleteTask, habits, goals, onAddHabit, onCompleteHabit, onAddGoal, onDeleteHabit, onDeleteGoal, onClearAllReminders, pendingAction, confirmDeletions]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const commandText = textInput.trim();
    if (!commandText) return;

    setTextInput('');
    stopAudioPlayback();
    await handleVoiceCommand(commandText);
  };

  const handleUndo = async (action: VoiceHistoryItem['actionTaken']) => {
    if (!action || !action.undoData) return;
    const { type, undoData } = action;

    try {
      if (type === 'create_task') {
        // Find the newly created task matching the title
        const newlyCreated = [...tasks].reverse().find(t => t.title === undoData.title);
        if (newlyCreated) {
          await onDeleteTask(newlyCreated.id);
        }
      } else if (type === 'update_task') {
        await onUpdateTask(undoData.id, undoData.previous);
      } else if (type === 'create_habit') {
        if (onDeleteHabit) {
          const newlyCreated = [...habits].reverse().find(h => h.name === undoData.name);
          if (newlyCreated) {
            await onDeleteHabit(newlyCreated.id);
          }
        }
      } else if (type === 'create_goal') {
        if (onDeleteGoal) {
          const newlyCreated = [...goals].reverse().find(g => g.title === undoData.title);
          if (newlyCreated) {
            await onDeleteGoal(newlyCreated.id);
          }
        }
      }
      
      // Add undo confirmation to history
      setHistory(prev => [
        ...prev, 
        { 
          sender: 'pulse', 
          text: `Undone successfully: ${action.description}` 
        }
      ]);
      
      playBrowserVoice(`Undone successfully.`);
    } catch (err) {
      console.error('Undo failed:', err);
    }
  };

  const playAudio = async (base64Audio: string) => {
    try {
      stopAudioPlayback();
      setIsPlaying(true);

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;

      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Buffer = new Int16Array(bytes.buffer);
      const float32Buffer = new Float32Array(int16Buffer.length);
      for (let i = 0; i < int16Buffer.length; i++) {
        float32Buffer[i] = int16Buffer[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32Buffer.length, 24000);
      audioBuffer.getChannelData(0).set(float32Buffer);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        setStatus('idle');
      };

      audioSourceRef.current = source;
      source.start(0);
    } catch (e) {
      console.warn('AudioContext playback error, falling back to browser TTS:', e);
      playBrowserVoice(response);
    }
  };

  const playBrowserVoice = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        setIsPlaying(false);
        setStatus('idle');
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setStatus('idle');
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlaying(false);
      setStatus('idle');
    }
  };

  const stopAudioPlayback = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  };

  return (
    <>
      {/* Floating Microphone Button */}
      <div className="fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="mb-4 mr-1 max-w-sm w-[340px] md:w-[380px]"
            >
              <NeumorphicContainer
                darkMode={darkMode}
                glass={true}
                className="p-5 flex flex-col max-h-[460px] h-[460px] border border-white/20 dark:border-white/10"
                rounded="3xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 dark:text-white leading-tight">Pulse Assistant</h4>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 font-mono">Real-time Voice AI</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 ml-auto mr-2 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-xl border border-gray-100/5">
                    <input
                      type="checkbox"
                      id="voice-confirm-deletions-toggle"
                      checked={confirmDeletions}
                      onChange={handleToggleConfirmDeletions}
                      className="w-3 h-3 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                    />
                    <label htmlFor="voice-confirm-deletions-toggle" className="text-[9px] text-gray-500 dark:text-gray-400 font-medium cursor-pointer select-none">
                      Confirm Deletes
                    </label>
                  </div>

                  <button
                    onClick={() => {
                      stopAudioPlayback();
                      if (recognitionRef.current) recognitionRef.current.abort();
                      setStatus('idle');
                      setIsOpen(false);
                    }}
                    className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* History / Messages Area */}
                <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1 font-sans text-xs scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-500/5 flex items-center justify-center border border-indigo-500/10 text-indigo-500">
                        <Mic className="w-6 h-6 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-gray-700 dark:text-gray-300">Talk to Pulse</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                          "Add task submit report by Friday"<br />
                          "Reschedule my presentation to tomorrow"<br />
                          "What does my day look like?"
                        </p>
                      </div>
                    </div>
                  ) : (
                    history.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div
                          className={`p-3 max-w-[85%] rounded-2xl leading-relaxed ${
                            item.sender === 'user'
                              ? 'bg-indigo-500 text-white rounded-tr-sm shadow-md'
                              : 'bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-100 rounded-tl-sm border border-gray-100/5'
                          }`}
                        >
                          {item.text}
                        </div>
                        
                        {/* Action + Undo Alert */}
                        {item.actionTaken && (
                          <div className="flex items-center gap-2 mt-1 px-1 py-1 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-[11px] w-full max-w-[85%]">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-gray-700 dark:text-gray-300 truncate block">
                                {item.actionTaken.description}
                              </span>
                            </div>
                            <button
                              onClick={() => handleUndo(item.actionTaken)}
                              className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all border border-indigo-500/5"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Undo
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {pendingAction && (
                    <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 space-y-3 shadow-inner my-2 animate-pulse">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-gray-800 dark:text-white text-xs">Confirm Voice Action</p>
                          <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                            Are you sure you want to <span className="font-semibold text-gray-800 dark:text-white">{pendingAction.description}</span>?
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <NeumorphicButton
                          id="voice-confirm-cancel-btn"
                          darkMode={darkMode}
                          onClick={handleCancelPendingAction}
                          className="py-1.5 px-3 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          Cancel
                        </NeumorphicButton>
                        <NeumorphicButton
                          id="voice-confirm-ok-btn"
                          darkMode={darkMode}
                          onClick={executePendingAction}
                          variant="danger"
                          className="py-1.5 px-3.5 text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 shadow-md"
                        >
                          Confirm
                        </NeumorphicButton>
                      </div>
                    </div>
                  )}
                  <div ref={historyEndRef} />
                </div>

                {/* Keyboard Text Fallback Input */}
                <form onSubmit={handleTextSubmit} className="my-2 flex gap-2">
                  <NeumorphicInput
                    id="voice-keyboard-input"
                    darkMode={darkMode}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type task command..."
                    className="py-2.5 px-3.5 text-xs font-sans"
                    disabled={status === 'processing'}
                  />
                  <NeumorphicButton
                    id="voice-keyboard-send-btn"
                    darkMode={darkMode}
                    type="submit"
                    variant="primary"
                    className="p-2.5 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    disabled={status === 'processing' || !textInput.trim()}
                  >
                    <Send className="w-4 h-4 text-white" />
                  </NeumorphicButton>
                </form>

                {/* Live Output Indicator / Microphone State */}
                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-gray-100/5 flex flex-col space-y-2">
                  {status === 'listening' && (
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1 items-center">
                        <span className="w-2 h-4 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <span className="w-2 h-6 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-2 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                        <span className="w-2 h-5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.45s' }} />
                      </div>
                      <span className="font-semibold text-indigo-500 italic text-xs animate-pulse">
                        {transcript || 'Listening...'}
                      </span>
                    </div>
                  )}

                  {status === 'processing' && (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span className="text-xs">Processing command...</span>
                    </div>
                  )}

                  {status === 'speaking' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-500">
                        <Volume2 className="w-4 h-4 animate-pulse" />
                        <span className="text-xs font-semibold animate-pulse">Speaking...</span>
                      </div>
                      <button
                        onClick={stopAudioPlayback}
                        className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
                      >
                        Mute
                      </button>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="flex flex-col space-y-2.5 w-full">
                      <div className="flex items-start gap-2 text-rose-500">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                        <span className="text-xs leading-relaxed">{errorMsg}</span>
                      </div>
                      <div className="flex justify-start">
                        <NeumorphicButton
                          id="voice-assistant-retry-button"
                          darkMode={darkMode}
                          onClick={() => startListening()}
                          variant="primary"
                          className="py-1.5 px-3.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-md rounded-xl"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-white" />
                          Try again
                        </NeumorphicButton>
                      </div>
                    </div>
                  )}

                  {status === 'idle' && (
                    <div className="flex flex-col items-center gap-1">
                      {errorMsg ? (
                        <div className="flex items-start gap-1 text-gray-500/80 dark:text-gray-400/80 text-[10px] justify-center text-center">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <span>{errorMsg}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center block">
                          Press microphone button below to talk to Pulse.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Toggle Controls inside the box */}
                <div className="flex justify-center pt-3 mt-3 border-t border-gray-100/10">
                  <NeumorphicButton
                    id="inner-voice-mic-btn"
                    darkMode={darkMode}
                    onClick={status === 'listening' ? stopListening : startListening}
                    variant={status === 'listening' ? 'danger' : 'primary'}
                    className="w-12 h-12 rounded-full flex items-center justify-center p-0 cursor-pointer shadow-lg"
                  >
                    {status === 'listening' ? (
                      <MicOff className="w-5 h-5 text-white" />
                    ) : (
                      <Mic className="w-5 h-5 text-white" />
                    )}
                  </NeumorphicButton>
                </div>
              </NeumorphicContainer>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Trigger Button */}
        <NeumorphicButton
          id="floating-voice-mic-trigger"
          darkMode={darkMode}
          onClick={handleToggleMic}
          variant={status === 'listening' ? 'danger' : isOpen ? 'secondary' : 'primary'}
          className={`w-14 h-14 rounded-full flex items-center justify-center p-0 cursor-pointer shadow-2xl relative transition-all duration-300 ${
            status === 'listening' ? 'animate-pulse scale-105 bg-red-500' : ''
          }`}
        >
          {status === 'listening' ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}

          {/* Mini Status Beacon */}
          {status !== 'idle' && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                status === 'listening' ? 'bg-red-400' : 'bg-indigo-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-4 w-4 ${
                status === 'listening' ? 'bg-red-500' : 'bg-indigo-500'
              }`}></span>
            </span>
          )}
        </NeumorphicButton>
      </div>
    </>
  );
};
