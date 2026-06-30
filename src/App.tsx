import { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  logout, 
  handleFirestoreError, 
  OperationType,
  getGoogleAccessToken,
  setGoogleAccessToken,
  handleRedirectResultToken,
  signInWithGoogle
} from './lib/firebase';
import { Task, Goal, Habit, ScheduleBlock, UserProfile, GCalEvent, Reminder, Milestone, Recommendation } from './types';
import { DESIGN_TOKENS } from './lib/designTokens';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { Tasks } from './components/Tasks';
import { GoalsHabits } from './components/GoalsHabits';
import { CalendarView } from './components/CalendarView';
import { Settings } from './components/Settings';
import { fetchGCalEvents, createGCalEvent, deleteGCalEvent } from './lib/gcalService';
import { runReminderEngine } from './lib/remindersEngine';
import { VoiceAssistant } from './components/VoiceAssistant';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(() => {
    return localStorage.getItem('pulse_local_user') !== null;
  });

  // Notification state for visual user feedback and error monitoring
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const showNotification = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => prev?.message === message ? null : prev);
    }, 5000);
  };

  // App tabs navigation state
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Real-time collections states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Google Calendar integration states
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalSyncStatus, setGcalSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'not_connected'>('not_connected');
  const [gcalLastSynced, setGcalLastSynced] = useState<string | null>(null);

  // Dark/Light theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('pulse_dark_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return true; // Default to eye-safe dark mode
  });

  // Recent AI action state (scheduler undo tracking)
  const [hasRecentScheduleAction, setHasRecentScheduleAction] = useState(false);
  const [recentActionExplanation, setRecentActionExplanation] = useState<string | null>(null);
  const [recentScheduledBlockIds, setRecentScheduledBlockIds] = useState<string[]>([]);

  // Autonomous Task Planning & Execution Agent states
  const [hasAutonomousAction, setHasAutonomousAction] = useState(false);
  const [autonomousActionExplanation, setAutonomousActionExplanation] = useState<string | null>(null);
  const [autonomousUndoState, setAutonomousUndoState] = useState<{
    originalTasks: { id: string; previous: Partial<Task> }[];
    originalBlocks: { id: string; previous: Partial<ScheduleBlock> }[];
    createdTaskIds: string[];
  } | null>(null);
  const [isAutonomousProcessing, setIsAutonomousProcessing] = useState(false);

  // AI Prioritization state
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const isFirstPrioritizeMount = useRef(true);
  const isFirstRecsMount = useRef(true);

  // Initialize and synchronize Dark Mode
  useEffect(() => {
    localStorage.setItem('pulse_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Auth Observer & User document listener
  useEffect(() => {
    // Check local sandbox session first
    const savedLocalUser = localStorage.getItem('pulse_local_user');
    if (savedLocalUser) {
      try {
        const parsedUser = JSON.parse(savedLocalUser);
        setUser(parsedUser);
        setIsLocalMode(true);
        setAuthLoading(false);
        
        // Load or initialize local profile
        const savedProfile = localStorage.getItem(`pulse_profile_${parsedUser.uid}`);
        if (savedProfile) {
          setUserProfile(JSON.parse(savedProfile));
        } else {
          const defaultProfile: UserProfile = {
            uid: parsedUser.uid,
            name: parsedUser.displayName || parsedUser.email?.split('@')[0] || 'Pulse User',
            email: parsedUser.email || '',
            workingHours: {
              start: '09:00',
              end: '17:00'
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
          };
          localStorage.setItem(`pulse_profile_${parsedUser.uid}`, JSON.stringify(defaultProfile));
          setUserProfile(defaultProfile);
        }
        return;
      } catch (e) {
        console.error("Failed to restore saved local user", e);
        localStorage.removeItem('pulse_local_user');
      }
    }

    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Unsubscribe from previous user document listener if exists
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      setUser(firebaseUser);
      setAuthLoading(false);

      if (firebaseUser) {
        setIsLocalMode(false);
        // Real-time listener for the user profile document
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.data() as UserProfile);
          } else {
            // Document doesn't exist yet, initialize it
            const defaultProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Pulse User',
              email: firebaseUser.email || '',
              workingHours: {
                start: '09:00',
                end: '17:00'
              },
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
            };
            try {
              await setDoc(userDocRef, defaultProfile);
              setUserProfile(defaultProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, []);

  // Real-time collection listeners filtered by logged-in user
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setGoals([]);
      setHabits([]);
      setScheduleBlocks([]);
      return;
    }

    if (isLocalMode) {
      const savedTasks = localStorage.getItem(`pulse_tasks_${user.uid}`);
      setTasks(savedTasks ? JSON.parse(savedTasks) : []);

      const savedGoals = localStorage.getItem(`pulse_goals_${user.uid}`);
      setGoals(savedGoals ? JSON.parse(savedGoals) : []);

      const savedHabits = localStorage.getItem(`pulse_habits_${user.uid}`);
      setHabits(savedHabits ? JSON.parse(savedHabits) : []);

      const savedBlocks = localStorage.getItem(`pulse_blocks_${user.uid}`);
      setScheduleBlocks(savedBlocks ? JSON.parse(savedBlocks) : []);

      const savedGCal = localStorage.getItem(`pulse_gcal_events_${user.uid}`);
      setGcalEvents(savedGCal ? JSON.parse(savedGCal) : []);

      const savedReminders = localStorage.getItem(`pulse_reminders_${user.uid}`);
      setReminders(savedReminders ? JSON.parse(savedReminders) : []);

      const savedRecs = localStorage.getItem(`pulse_recs_${user.uid}`);
      setRecommendations(savedRecs ? JSON.parse(savedRecs) : []);

      return;
    }

    // 1. Tasks Listener
    const tasksQuery = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Task);
      });
      setTasks(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    // 2. Goals Listener
    const goalsQuery = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsubscribeGoals = onSnapshot(goalsQuery, (snapshot) => {
      const list: Goal[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Goal);
      });
      setGoals(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goals');
    });

    // 3. Habits Listener
    const habitsQuery = query(collection(db, 'habits'), where('userId', '==', user.uid));
    const unsubscribeHabits = onSnapshot(habitsQuery, (snapshot) => {
      const list: Habit[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Habit);
      });
      setHabits(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'habits');
    });

    // 4. Schedule Blocks Listener
    const blocksQuery = query(collection(db, 'scheduleBlocks'), where('userId', '==', user.uid));
    const unsubscribeBlocks = onSnapshot(blocksQuery, (snapshot) => {
      const list: ScheduleBlock[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ScheduleBlock);
      });
      setScheduleBlocks(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'scheduleBlocks');
    });

    // 5. Google Calendar Events Listener
    const gcalQuery = query(collection(db, 'gcalEvents'), where('userId', '==', user.uid));
    const unsubscribeGCal = onSnapshot(gcalQuery, (snapshot) => {
      const list: GCalEvent[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as GCalEvent);
      });
      setGcalEvents(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gcalEvents');
    });

    // 6. Reminders Listener
    const remindersQuery = query(collection(db, 'reminders'), where('userId', '==', user.uid));
    const unsubscribeReminders = onSnapshot(remindersQuery, (snapshot) => {
      const list: Reminder[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Reminder);
      });
      setReminders(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reminders');
    });

    // 7. Recommendations Listener
    const recommendationsQuery = query(collection(db, 'recommendations'), where('userId', '==', user.uid));
    const unsubscribeRecommendations = onSnapshot(recommendationsQuery, (snapshot) => {
      const list: Recommendation[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Recommendation);
      });
      setRecommendations(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recommendations');
    });

    return () => {
      unsubscribeTasks();
      unsubscribeGoals();
      unsubscribeHabits();
      unsubscribeBlocks();
      unsubscribeGCal();
      unsubscribeReminders();
      unsubscribeRecommendations();
    };
  }, [user, isLocalMode]);

  // Automatically check and reset broken habit streaks on mount / state change
  const hasCheckedStreaks = useRef<string | null>(null);
  useEffect(() => {
    if (!user || habits.length === 0) return;
    
    // Guard to run only once per user session / day to avoid infinite loops
    const checkKey = `${user.uid}_${new Date().toDateString()}`;
    if (hasCheckedStreaks.current === checkKey) return;
    hasCheckedStreaks.current = checkKey;

    const checkAndResetStreaks = async () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let changed = false;
      const updatedHabits = habits.map(habit => {
        if (habit.streak > 0 && habit.lastCompletedAt) {
          const lastCompletedDate = new Date(habit.lastCompletedAt);
          lastCompletedDate.setHours(0,0,0,0);

          let isBroken = false;
          if (habit.frequency === 'daily') {
            if (lastCompletedDate.getTime() < yesterday.getTime()) {
              isBroken = true;
            }
          } else if (habit.frequency === 'weekly') {
            const diffDays = (today.getTime() - lastCompletedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 7) {
              isBroken = true;
            }
          }

          if (isBroken) {
            changed = true;
            return { ...habit, streak: 0 };
          }
        }
        return habit;
      });

      if (changed) {
        if (isLocalMode) {
          setHabits(updatedHabits);
          localStorage.setItem(`pulse_habits_${user.uid}`, JSON.stringify(updatedHabits));
        } else {
          for (const updatedHabit of updatedHabits) {
            const original = habits.find(h => h.id === updatedHabit.id);
            if (original && original.streak !== updatedHabit.streak) {
              try {
                const docRef = doc(db, 'habits', updatedHabit.id);
                await updateDoc(docRef, { streak: 0 });
              } catch (err) {
                console.warn("Failed to reset streak in Firestore:", err);
              }
            }
          }
        }
      }
    };

    checkAndResetStreaks();
  }, [user, habits, isLocalMode]);

  // Auth Handlers
  const handleLoginSuccess = (firebaseUser: any) => {
    setUser(firebaseUser);
    if (firebaseUser.isLocalSandbox) {
      setIsLocalMode(true);
    } else {
      setIsLocalMode(false);
    }
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    localStorage.removeItem('pulse_local_user');
    setIsLocalMode(false);
    await logout();
    setUser(null);
    setUserProfile(null);
    setActiveTab('dashboard');
  };

  // Google Calendar synchronization handlers
  const triggerGCalSync = async (forceToken?: string) => {
    if (!user) return;
    const token = forceToken || getGoogleAccessToken();
    if (!token) {
      setGcalSyncStatus('not_connected');
      return;
    }

    setGcalSyncStatus('syncing');
    try {
      const events = await fetchGCalEvents(token, user.uid);
      
      if (isLocalMode) {
        setGcalEvents(events);
        localStorage.setItem(`pulse_gcal_events_${user.uid}`, JSON.stringify(events));
      } else {
        // Overwrite Firestore gcalEvents
        const q = query(collection(db, 'gcalEvents'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach((d) => {
          batch.delete(d.ref);
        });

        events.forEach((evt) => {
          const docRef = doc(collection(db, 'gcalEvents'), evt.id);
          batch.set(docRef, evt);
        });

        await batch.commit();
      }

      setGcalLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setGcalSyncStatus('success');
      showNotification('Google Calendar sync successful!', 'success');
    } catch (error: any) {
      console.error("GCal sync error:", error);
      setGcalSyncStatus('error');
      showNotification(`GCal Sync failed: ${error.message || error}`, 'error');
    }
  };

  const handleConnectGCal = async () => {
    try {
      await signInWithGoogle();
      const token = getGoogleAccessToken();
      if (token) {
        await triggerGCalSync(token);
      } else {
        showNotification('Connected to Google! Pulling calendar sync...', 'info');
        // Let's retry fetching token briefly as redirect/popup updates auth state async
        setTimeout(() => {
          const recheckToken = getGoogleAccessToken();
          if (recheckToken) {
            triggerGCalSync(recheckToken);
          }
        }, 1500);
      }
    } catch (error: any) {
      console.error("Connect GCal error:", error);
      showNotification(`Failed to connect Google Calendar: ${error.message || error}`, 'error');
    }
  };

  // Auto-sync Google Calendar on mount/redirect or when user changes
  useEffect(() => {
    if (user && !isLocalMode) {
      handleRedirectResultToken().then(() => {
        const token = getGoogleAccessToken();
        if (token) {
          setGcalSyncStatus('idle');
          triggerGCalSync(token);
        }
      });
    }
  }, [user, isLocalMode]);

  // Profile update helper
  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    if (isLocalMode) {
      const newProfile = { ...userProfile, ...updates } as UserProfile;
      setUserProfile(newProfile);
      localStorage.setItem(`pulse_profile_${user.uid}`, JSON.stringify(newProfile));
      return;
    }
    const docRef = doc(db, 'users', user.uid);
    await updateDoc(docRef, updates);
  };

  // --- REMINDERS ENGINE & HANDLERS ---
  const handleDismissReminder = async (id: string) => {
    if (!user) return;
    const rem = reminders.find(r => r.id === id);
    if (!rem) return;

    if (!rem.sent) {
      // Mark as sent so toast disappears
      if (isLocalMode) {
        const updated = reminders.map(r => r.id === id ? { ...r, sent: true } : r);
        setReminders(updated);
        localStorage.setItem(`pulse_reminders_${user.uid}`, JSON.stringify(updated));
      } else {
        try {
          const docRef = doc(db, 'reminders', id);
          await updateDoc(docRef, { sent: true });
        } catch (err) {
          console.error("Failed to dismiss reminder", err);
        }
      }
    } else {
      // Hide from history by marking as dismissed
      if (isLocalMode) {
        const updated = reminders.map(r => r.id === id ? { ...r, dismissed: true } : r);
        setReminders(updated);
        localStorage.setItem(`pulse_reminders_${user.uid}`, JSON.stringify(updated));
      } else {
        try {
          const docRef = doc(db, 'reminders', id);
          await updateDoc(docRef, { dismissed: true });
        } catch (err) {
          console.error("Failed to delete reminder", err);
        }
      }
    }
  };

  const handleClearAllReminders = async () => {
    if (!user) return;
    if (isLocalMode) {
      const updated = reminders.map(r => ({ ...r, dismissed: true, sent: true }));
      setReminders(updated);
      localStorage.setItem(`pulse_reminders_${user.uid}`, JSON.stringify(updated));
    } else {
      try {
        for (const rem of reminders) {
          if (!rem.dismissed) {
            const docRef = doc(db, 'reminders', rem.id);
            await updateDoc(docRef, { dismissed: true, sent: true });
          }
        }
      } catch (err) {
        console.error("Failed to clear reminders", err);
      }
    }
  };

  // Context-Aware Reminders Engine periodic runner
  useEffect(() => {
    if (!user) return;

    const runEngine = async () => {
      try {
        await runReminderEngine(
          user,
          tasks,
          scheduleBlocks,
          reminders,
          userProfile,
          isLocalMode,
          (updated) => setReminders(updated)
        );
      } catch (err) {
        console.error("Error executing reminder engine", err);
      }
    };

    runEngine();

    // Run every 20 seconds to keep checking approaching deadlines
    const interval = setInterval(runEngine, 20000);

    return () => clearInterval(interval);
  }, [user, tasks, scheduleBlocks, reminders, userProfile, isLocalMode]);

  // --- BACKGROUND AUTONOMOUS PLANNING PROCESS (REMOVED AUTOMATIC TIMERS TO PREVENT COOLDOWNS) ---

  // --- CRUD HANDLERS (PERSISTENT VIA FIRESTORE OR LOCALSTORAGE) ---

  // --- AI TASK PRIORITIZATION ---
  const runTaskPrioritization = async (listToPrioritize: Task[]) => {
    if (!user || listToPrioritize.length === 0 || isPrioritizing) return;
    setIsPrioritizing(true);
    try {
      const response = await fetch('/api/prioritize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: listToPrioritize,
          currentTime: new Date().toISOString()
        })
      });
      const data = await response.json();
      if (data.success && data.prioritizations) {
        const scoreMap: { [id: string]: { priorityScore: number; priorityReason: string } } = {};
        data.prioritizations.forEach((item: any) => {
          scoreMap[item.taskId] = {
            priorityScore: item.priorityScore,
            priorityReason: item.priorityReason
          };
        });

        if (isLocalMode) {
          const updated = listToPrioritize.map(t => {
            if (scoreMap[t.id]) {
              return {
                ...t,
                priorityScore: scoreMap[t.id].priorityScore,
                priorityReason: scoreMap[t.id].priorityReason
              };
            }
            return t;
          });
          setTasks(updated);
          localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
        } else {
          const batch = writeBatch(db);
          let updatedCount = 0;
          listToPrioritize.forEach(t => {
            if (scoreMap[t.id]) {
              const docRef = doc(db, 'tasks', t.id);
              batch.update(docRef, {
                priorityScore: scoreMap[t.id].priorityScore,
                priorityReason: scoreMap[t.id].priorityReason
              });
              updatedCount++;
            }
          });
          if (updatedCount > 0) {
            await batch.commit();
          }
        }

        const currentTasksSig = JSON.stringify(listToPrioritize.map(t => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline || '',
          status: t.status
        })));
        await handleUpdateProfile({
          tasksPrioritizationSignature: currentTasksSig,
          lastPrioritizedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Failed to prioritize tasks:", error);
    } finally {
      setIsPrioritizing(false);
    }
  };

  // Daily automatic task prioritization based on signature change and date change
  useEffect(() => {
    if (!user || tasks.length === 0 || isPrioritizing || !userProfile) return;
    
    if (isFirstPrioritizeMount.current) {
      isFirstPrioritizeMount.current = false;
      return;
    }

    const currentTasksSig = JSON.stringify(tasks.map(t => ({
      id: t.id,
      title: t.title,
      deadline: t.deadline || '',
      status: t.status
    })));

    // Only run if the signature is different (i.e. the tasks list actually changed in a meaningful way)
    if (userProfile.tasksPrioritizationSignature === currentTasksSig) {
      return;
    }

    // Also limit automatic runs to once per day to prevent aggressive automatic calls
    const lastPrioritizedDate = userProfile.lastPrioritizedAt 
      ? new Date(userProfile.lastPrioritizedAt).toDateString()
      : '';
    const today = new Date().toDateString();

    if (lastPrioritizedDate !== today) {
      runTaskPrioritization(tasks);
    }
  }, [user, tasks.length, userProfile?.tasksPrioritizationSignature]);

  // 1. Tasks CRUD
  const handleAddTask = async (taskData: Omit<Task, 'id' | 'userId' | 'createdAt'>) => {
    if (!user) return;
    if (isLocalMode) {
      const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTask: Task = {
        ...taskData,
        id: newId,
        userId: user.uid,
        createdAt: new Date().toISOString()
      };
      const updated = [...tasks, newTask];
      setTasks(updated);
      localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
      showNotification("Task created locally successfully", "success");
      return;
    }
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      showNotification("Task created successfully", "success");
    } catch (error) {
      showNotification("Failed to create task", "error");
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    if (!user) return;

    if (isLocalMode) {
      const updated = tasks.map(t => t.id === id ? { ...t, ...updates } : t);
      setTasks(updated);
      localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
      return;
    }
    try {
      const docRef = doc(db, 'tasks', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      showNotification("Failed to update task", "error");
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    if (isLocalMode) {
      const updated = tasks.filter(t => t.id !== id);
      setTasks(updated);
      localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
      showNotification("Task deleted locally successfully", "success");
      return;
    }
    try {
      const docRef = doc(db, 'tasks', id);
      await deleteDoc(docRef);
      showNotification("Task deleted successfully", "success");
    } catch (error) {
      showNotification("Failed to delete task", "error");
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  // 2. Goals CRUD
  const handleAddGoal = async (goalData: Omit<Goal, 'id' | 'userId'>, aiBreakdown?: boolean) => {
    if (!user) return;

    let finalMilestones: Milestone[] = goalData.milestones || [];
    let tasksToCreate: any[] = [];

    if (aiBreakdown) {
      showNotification("AI is analyzing and breaking down your goal...", "info");
      try {
        const response = await fetch("/api/breakdown-goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: goalData.title, targetDate: goalData.targetDate })
        });
        const data = await response.json();
        if (data.success) {
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
        console.warn("Failed to call AI breakdown endpoint, using default milestone:", err);
      }
    }

    if (finalMilestones.length === 0) {
      finalMilestones = [{ title: "Define parameters", dueDate: new Date().toISOString(), done: false }];
    }

    const goalToSave = {
      ...goalData,
      milestones: finalMilestones,
      progressPercent: 0
    };

    let savedGoalId = "";
    if (isLocalMode) {
      const newId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newGoal: Goal = {
        ...goalToSave,
        id: newId,
        userId: user.uid,
      };
      const updated = [...goals, newGoal];
      setGoals(updated);
      localStorage.setItem(`pulse_goals_${user.uid}`, JSON.stringify(updated));
      savedGoalId = newId;
    } else {
      try {
        const docRef = await addDoc(collection(db, 'goals'), {
          ...goalToSave,
          userId: user.uid,
        });
        savedGoalId = docRef.id;
      } catch (error) {
        showNotification("Failed to create goal", "error");
        handleFirestoreError(error, OperationType.CREATE, 'goals');
        return;
      }
    }

    // Now, create the tasks linked to this goal's milestones
    if (tasksToCreate.length > 0) {
      for (const t of tasksToCreate) {
        const taskData = {
          title: t.title,
          description: t.description,
          category: t.category,
          estimatedMinutes: t.estimatedMinutes,
          deadline: new Date(t.deadline).toISOString(),
          status: 'todo' as const,
          priorityScore: 50,
          priorityReason: `Generated milestone task: ${t.milestoneTitle}`
        };
        await handleAddTask(taskData);
      }
      showNotification(`Goal created! AI broke it into ${finalMilestones.length} milestones & ${tasksToCreate.length} tasks!`, "success");
    } else {
      showNotification("Goal created successfully", "success");
    }
  };

  const handleUpdateGoal = async (id: string, updates: Partial<Goal>) => {
    if (!user) return;
    if (isLocalMode) {
      const updated = goals.map(g => g.id === id ? { ...g, ...updates } : g);
      setGoals(updated);
      localStorage.setItem(`pulse_goals_${user.uid}`, JSON.stringify(updated));
      return;
    }
    try {
      const docRef = doc(db, 'goals', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      showNotification("Failed to update goal", "error");
      handleFirestoreError(error, OperationType.UPDATE, `goals/${id}`);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!user) return;
    if (isLocalMode) {
      const updated = goals.filter(g => g.id !== id);
      setGoals(updated);
      localStorage.setItem(`pulse_goals_${user.uid}`, JSON.stringify(updated));
      showNotification("Goal deleted locally successfully", "success");
      return;
    }
    try {
      const docRef = doc(db, 'goals', id);
      await deleteDoc(docRef);
      showNotification("Goal deleted successfully", "success");
    } catch (error) {
      showNotification("Failed to delete goal", "error");
      handleFirestoreError(error, OperationType.DELETE, `goals/${id}`);
    }
  };

  // 3. Habits CRUD
  const handleAddHabit = async (habitData: Omit<Habit, 'id' | 'userId' | 'streak'>) => {
    if (!user) return;
    if (isLocalMode) {
      const newId = `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newHabit: Habit = {
        ...habitData,
        id: newId,
        userId: user.uid,
        streak: 0
      };
      const updated = [...habits, newHabit];
      setHabits(updated);
      localStorage.setItem(`pulse_habits_${user.uid}`, JSON.stringify(updated));
      showNotification("Habit created locally successfully", "success");
      return;
    }
    try {
      await addDoc(collection(db, 'habits'), {
        ...habitData,
        userId: user.uid,
        streak: 0
      });
      showNotification("Habit created successfully", "success");
    } catch (error) {
      showNotification("Failed to create habit", "error");
      handleFirestoreError(error, OperationType.CREATE, 'habits');
    }
  };

  const handleUpdateHabit = async (id: string, updates: Partial<Habit>) => {
    if (!user) return;
    if (isLocalMode) {
      const updated = habits.map(h => h.id === id ? { ...h, ...updates } : h);
      setHabits(updated);
      localStorage.setItem(`pulse_habits_${user.uid}`, JSON.stringify(updated));
      return;
    }
    try {
      const docRef = doc(db, 'habits', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      showNotification("Failed to update habit", "error");
      handleFirestoreError(error, OperationType.UPDATE, `habits/${id}`);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    if (!user) return;
    if (isLocalMode) {
      const updated = habits.filter(h => h.id !== id);
      setHabits(updated);
      localStorage.setItem(`pulse_habits_${user.uid}`, JSON.stringify(updated));
      showNotification("Habit deleted locally successfully", "success");
      return;
    }
    try {
      const docRef = doc(db, 'habits', id);
      await deleteDoc(docRef);
      showNotification("Habit deleted successfully", "success");
    } catch (error) {
      showNotification("Failed to delete habit", "error");
      handleFirestoreError(error, OperationType.DELETE, `habits/${id}`);
    }
  };

  const handleCompleteHabit = async (id: string) => {
    if (!user) return;
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;

    const todayDateStr = new Date().toDateString();
    if (habit.lastCompletedAt) {
      const lastCompletedDateStr = new Date(habit.lastCompletedAt).toDateString();
      if (lastCompletedDateStr === todayDateStr) {
        // Already completed today, do not increment again
        return;
      }
    }

    // Determine streak behavior
    let newStreak = habit.streak + 1;
    if (habit.lastCompletedAt) {
      const lastDate = new Date(habit.lastCompletedAt);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // If the last completion was before yesterday, reset streak to 1
      if (lastDate.toDateString() !== yesterday.toDateString() && lastDate.toDateString() !== todayDateStr) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const todayYYYYMMDD = new Date().toISOString().split('T')[0];
    const completedDates = Array.isArray(habit.completedDates)
      ? [...habit.completedDates]
      : [];
    if (!completedDates.includes(todayYYYYMMDD)) {
      completedDates.push(todayYYYYMMDD);
    }

    if (isLocalMode) {
      const updated = habits.map(h => h.id === id ? { ...h, streak: newStreak, lastCompletedAt: new Date().toISOString(), completedDates } : h);
      setHabits(updated);
      localStorage.setItem(`pulse_habits_${user.uid}`, JSON.stringify(updated));
      showNotification("Habit completed!", "success");
      return;
    }

    try {
      const docRef = doc(db, 'habits', id);
      await updateDoc(docRef, {
        streak: newStreak,
        lastCompletedAt: new Date().toISOString(),
        completedDates
      });
      showNotification("Habit completed!", "success");
    } catch (error) {
      showNotification("Failed to complete habit", "error");
      handleFirestoreError(error, OperationType.UPDATE, `habits/${id}`);
    }
  };

  // --- PROACTIVE AI AUTONOMOUS SCHEDULER & UNDO (RULE 4 & 9) ---

  const isSlotBusy = (start: Date, end: Date, existingBlocks: ScheduleBlock[], gcalEventsList: GCalEvent[]) => {
    const sTime = start.getTime();
    const eTime = end.getTime();

    // Check existing local blocks
    const blockOverlap = existingBlocks.some(block => {
      const bStart = new Date(block.start).getTime();
      const bEnd = new Date(block.end).getTime();
      return sTime < bEnd && eTime > bStart;
    });
    if (blockOverlap) return true;

    // Check GCal events
    const gcalOverlap = gcalEventsList.some(event => {
      if (!event.isBusy) return false;
      const eStart = new Date(event.start).getTime();
      const eEnd = new Date(event.end).getTime();
      return sTime < eEnd && eTime > eStart;
    });
    return gcalOverlap;
  };

  const handleAutoSchedule = async () => {
    if (!user || !userProfile) return;

    // Filter pending/in-progress tasks
    const pendingTasks = tasks.filter((t) => t.status !== 'done');
    if (pendingTasks.length === 0) {
      setRecentActionExplanation("You don't have any pending tasks to schedule!");
      setHasRecentScheduleAction(true);
      return;
    }

    // Sort pending tasks by priorityScore descending, then by deadline ascending
    const sortedTasks = [...pendingTasks].sort((a, b) => {
      const scoreDiff = b.priorityScore - a.priorityScore;
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const startWorkHour = parseInt(userProfile.workingHours?.start?.split(':')[0] || '09');
    const startWorkMin = parseInt(userProfile.workingHours?.start?.split(':')[1] || '00');
    const endWorkHour = parseInt(userProfile.workingHours?.end?.split(':')[0] || '17');

    const scheduledBlockIds: string[] = [];
    const scheduledDetails: string[] = [];
    const newLocalBlocks: ScheduleBlock[] = [];

    // Let's schedule starting today (if before end of day) or tomorrow
    let currentScheduleTime = new Date();
    if (currentScheduleTime.getHours() >= endWorkHour) {
      // Start scheduling tomorrow
      currentScheduleTime.setDate(currentScheduleTime.getDate() + 1);
    }
    currentScheduleTime.setHours(startWorkHour, startWorkMin, 0, 0);

    const batch = !isLocalMode ? writeBatch(db) : null;
    const gcalToken = getGoogleAccessToken();

    // Schedule up to 4 high-priority tasks for today/tomorrow bounds to keep it compact and real
    const tasksToSchedule = sortedTasks.slice(0, 4);

    for (const task of tasksToSchedule) {
      const durationMin = task.estimatedMinutes || 45;
      let blockStart = new Date(currentScheduleTime);
      let blockEnd = new Date(currentScheduleTime.getTime() + durationMin * 60000);

      // Find the next available non-busy slot
      let slotFound = false;
      let maxAttempts = 48; // prevent infinite loops
      let attempt = 0;

      while (!slotFound && attempt < maxAttempts) {
        attempt++;
        
        // 1. Check if block fits in working hours. If it goes beyond endWorkHour, shift to start of next day
        if (blockEnd.getHours() > endWorkHour || (blockEnd.getHours() === endWorkHour && blockEnd.getMinutes() > 0)) {
          currentScheduleTime.setDate(currentScheduleTime.getDate() + 1);
          currentScheduleTime.setHours(startWorkHour, startWorkMin, 0, 0);
          
          blockStart = new Date(currentScheduleTime);
          blockEnd = new Date(currentScheduleTime.getTime() + durationMin * 60000);
          continue;
        }

        // 2. Check if this time slot overlaps with any local block or busy GCal event
        if (isSlotBusy(blockStart, blockEnd, [...scheduleBlocks, ...newLocalBlocks], gcalEvents)) {
          // Advance currentScheduleTime by 15 minutes to find the next slot
          currentScheduleTime.setTime(currentScheduleTime.getTime() + 15 * 60000);
          blockStart = new Date(currentScheduleTime);
          blockEnd = new Date(currentScheduleTime.getTime() + durationMin * 60000);
        } else {
          slotFound = true;
        }
      }

      // Generate doc ID
      const blockId = isLocalMode 
        ? `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
        : doc(collection(db, 'scheduleBlocks')).id;

      // Sync to Google Calendar if token is available
      let gcalEventId: string | undefined = undefined;
      if (gcalToken) {
        try {
          gcalEventId = await createGCalEvent(gcalToken, { start: blockStart.toISOString(), end: blockEnd.toISOString() }, `Focus Session: ${task.title}`);
        } catch (e) {
          console.error("Failed to create GCal event:", e);
        }
      }

      const blockData: Omit<ScheduleBlock, 'id'> & { id?: string } = {
        userId: user.uid,
        taskId: task.id,
        start: blockStart.toISOString(),
        end: blockEnd.toISOString(),
        gcalEventId: gcalEventId || null,
      };

      if (isLocalMode) {
        newLocalBlocks.push({ ...blockData, id: blockId } as ScheduleBlock);
      } else if (batch) {
        const newBlockRef = doc(db, 'scheduleBlocks', blockId);
        batch.set(newBlockRef, blockData);
      }
      scheduledBlockIds.push(blockId);
      
      const timeStr = blockStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const dateStr = blockStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      scheduledDetails.push(`"${task.title}" scheduled for ${dateStr} at ${timeStr} (${durationMin} min allocation)${gcalEventId ? " (Synced to Google Calendar)" : ""}`);

      // Advance schedule cursor by task duration + 15 min buffer
      currentScheduleTime.setTime(blockEnd.getTime() + 15 * 60000);
    }

    if (isLocalMode) {
      const updated = [...scheduleBlocks, ...newLocalBlocks];
      setScheduleBlocks(updated);
      localStorage.setItem(`pulse_blocks_${user.uid}`, JSON.stringify(updated));
    } else if (batch) {
      await batch.commit();
    }

    setRecentScheduledBlockIds(scheduledBlockIds);
    setRecentActionExplanation(
      `Pulse proactively booked ${scheduledBlockIds.length} focus slot(s) matching your high priority goals:\n` +
      scheduledDetails.join('\n')
    );
    setHasRecentScheduleAction(true);
    setActiveTab('dashboard'); // Redirect to dashboard to show results
  };

  const handleUndoSchedule = async () => {
    if (!user || recentScheduledBlockIds.length === 0) return;

    // Delete matching events in Google Calendar if connected
    const gcalToken = getGoogleAccessToken();
    if (gcalToken) {
      const blocksToDelete = scheduleBlocks.filter(b => recentScheduledBlockIds.includes(b.id));
      for (const block of blocksToDelete) {
        if (block.gcalEventId) {
          try {
            await deleteGCalEvent(gcalToken, block.gcalEventId);
          } catch (e) {
            console.error("Failed to delete GCal event:", e);
          }
        }
      }
    }

    if (isLocalMode) {
      const updated = scheduleBlocks.filter(b => !recentScheduledBlockIds.includes(b.id));
      setScheduleBlocks(updated);
      localStorage.setItem(`pulse_blocks_${user.uid}`, JSON.stringify(updated));
    } else {
      const batch = writeBatch(db);
      recentScheduledBlockIds.forEach((blockId) => {
        const docRef = doc(db, 'scheduleBlocks', blockId);
        batch.delete(docRef);
      });
      await batch.commit();
    }

    setRecentScheduledBlockIds([]);
    setRecentActionExplanation(null);
    setHasRecentScheduleAction(false);
  };

  const handleSaveProposedBlocks = async (blocks: Omit<ScheduleBlock, 'id' | 'userId'>[]) => {
    if (!user) return;
    const batch = !isLocalMode ? writeBatch(db) : null;
    const addedBlocks: ScheduleBlock[] = [];
    const blockIds: string[] = [];

    for (const block of blocks) {
      const blockId = isLocalMode 
        ? `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
        : doc(collection(db, 'scheduleBlocks')).id;
      
      const newBlock = {
        ...block,
        id: blockId,
        userId: user.uid
      } as ScheduleBlock;

      if (isLocalMode) {
        addedBlocks.push(newBlock);
      } else if (batch) {
        const docRef = doc(db, 'scheduleBlocks', blockId);
        batch.set(docRef, { ...block, userId: user.uid });
      }
      blockIds.push(blockId);
    }

    if (isLocalMode) {
      const updated = [...scheduleBlocks, ...addedBlocks];
      setScheduleBlocks(updated);
      localStorage.setItem(`pulse_blocks_${user.uid}`, JSON.stringify(updated));
    } else if (batch) {
      await batch.commit();
    }

    setRecentScheduledBlockIds(blockIds);
    setRecentActionExplanation(`Successfully saved ${blocks.length} scheduled focus blocks from your Day Planner.`);
    setHasRecentScheduleAction(true);
    showNotification(`Saved ${blocks.length} focus blocks to your calendar!`, "success");
  };

  const handleUpdateScheduleBlock = async (id: string, updates: Partial<ScheduleBlock>) => {
    if (!user) return;
    if (isLocalMode) {
      const updated = scheduleBlocks.map(b => b.id === id ? { ...b, ...updates } : b);
      setScheduleBlocks(updated);
      localStorage.setItem(`pulse_blocks_${user.uid}`, JSON.stringify(updated));
      return;
    }
    try {
      const docRef = doc(db, 'scheduleBlocks', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      showNotification("Failed to update schedule block", "error");
      handleFirestoreError(error, OperationType.UPDATE, `scheduleBlocks/${id}`);
    }
  };

  const handleDeleteScheduleBlock = async (id: string) => {
    if (!user) return;
    const blockToDelete = scheduleBlocks.find(b => b.id === id);
    if (!blockToDelete) return;

    // Delete matching event in Google Calendar if connected and exists
    if (blockToDelete.gcalEventId) {
      const gcalToken = getGoogleAccessToken();
      if (gcalToken) {
        try {
          await deleteGCalEvent(gcalToken, blockToDelete.gcalEventId);
        } catch (e) {
          console.error("Failed to delete GCal event:", e);
        }
      }
    }

    if (isLocalMode) {
      const updated = scheduleBlocks.filter(b => b.id !== id);
      setScheduleBlocks(updated);
      localStorage.setItem(`pulse_blocks_${user.uid}`, JSON.stringify(updated));
      showNotification("Focus block deleted locally successfully", "success");
      return;
    }

    try {
      const docRef = doc(db, 'scheduleBlocks', id);
      await deleteDoc(docRef);
      showNotification("Focus block deleted successfully", "success");
    } catch (error) {
      showNotification("Failed to delete focus block", "error");
      handleFirestoreError(error, OperationType.DELETE, `scheduleBlocks/${id}`);
    }
  };

  const runLocalAutonomousFallback = async () => {
    if (!user) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const details: string[] = [];

    const undoState = {
      originalTasks: [] as { id: string; previous: Partial<Task> }[],
      originalBlocks: [] as { id: string; previous: Partial<ScheduleBlock> }[],
      createdTaskIds: [] as string[]
    };

    try {
      // 1. Overdue tasks (missed deadlines)
      const overdueTasks = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < todayStr);
      if (overdueTasks.length > 0) {
        for (const t of overdueTasks.slice(0, 2)) {
          undoState.originalTasks.push({
            id: t.id,
            previous: { deadline: t.deadline, priorityReason: t.priorityReason || "" }
          });
          await handleUpdateTask(t.id, {
            deadline: tomorrowStr,
            priorityReason: "Automatically shifted overdue task to tomorrow for breathing room."
          });
          details.push(`• Overdue task "${t.title}" rescheduled to tomorrow.`);
        }
      }

      // 2. Overloaded day
      const todayTasks = tasks.filter(t => t.status !== 'done' && t.deadline === todayStr);
      const todayMinutes = todayTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
      if (todayMinutes > 240 && todayTasks.length > 2) {
        const lowestPriority = [...todayTasks].sort((a, b) => (a.priorityScore || 50) - (b.priorityScore || 50))[0];
        if (lowestPriority) {
          undoState.originalTasks.push({
            id: lowestPriority.id,
            previous: { deadline: lowestPriority.deadline, priorityReason: lowestPriority.priorityReason || "" }
          });
          await handleUpdateTask(lowestPriority.id, {
            deadline: tomorrowStr,
            priorityReason: "Shifted to tomorrow to balance today's overload (exceeded 4 hours)."
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
          const newTaskId = isLocalMode 
            ? `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
            : doc(collection(db, 'tasks')).id;

          const newTaskData = {
            id: newTaskId,
            userId: user.uid,
            title: `Next step: ${incompleteMilestone.title}`,
            description: `Focus on completing the first micro-milestone for your goal "${goal.title}".`,
            category: "Work",
            estimatedMinutes: 30,
            deadline: tomorrowStr,
            status: "todo" as const,
            priorityScore: 85,
            priorityReason: `Autonomously split from stalled goal to restart progress.`,
            createdAt: new Date().toISOString()
          };

          if (isLocalMode) {
            const updated = [...tasks, newTaskData];
            setTasks(updated);
            localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
          } else {
            await setDoc(doc(db, 'tasks', newTaskId), newTaskData);
          }
          undoState.createdTaskIds.push(newTaskId);
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
        const newTaskId = isLocalMode 
          ? `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
          : doc(collection(db, 'tasks')).id;

        const newTaskData = {
          id: newTaskId,
          userId: user.uid,
          title: `Revive: 10m on ${habit.name}`,
          description: `Your habit "${habit.name}" has had its streak broken. Let's start ultra-small to build back momentum!`,
          category: "Habit",
          estimatedMinutes: 15,
          deadline: todayStr,
          status: "todo" as const,
          priorityScore: 90,
          priorityReason: `Autonomously created to recover habit streak momentum.`,
          createdAt: new Date().toISOString()
        };

        if (isLocalMode) {
          const updated = [...tasks, newTaskData];
          setTasks(updated);
          localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
        } else {
          await setDoc(doc(db, 'tasks', newTaskId), newTaskData);
        }
        undoState.createdTaskIds.push(newTaskId);
        details.push(`• Drafted a habit recovery task to revive your momentum for "${habit.name}".`);
      }

      if (details.length > 0) {
        const explanation = `Pulse Engine automatically optimized your schedule (offline-mode):\n\n` + details.join('\n');
        setAutonomousUndoState(undoState);
        setAutonomousActionExplanation(explanation);
        setHasAutonomousAction(true);
        showNotification("Autonomous Local optimization complete!", "success");
      } else {
        showNotification("All systems in sync! No autonomous optimization needed.", "info");
      }
    } catch (fallbackError) {
      console.error("Local autonomous fallback failed:", fallbackError);
    }
  };

  const detectProductivityIssues = () => {
    if (tasks.length === 0 && goals.length === 0 && habits.length === 0) return false;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Missed Deadlines
    const hasMissedDeadlines = tasks.some(t => t.status !== 'done' && t.deadline && t.deadline < todayStr);
    if (hasMissedDeadlines) return true;

    // 2. Overloaded Day
    const todayTasks = tasks.filter(t => t.status !== 'done' && t.deadline === todayStr);
    const todayMinutes = todayTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
    if (todayMinutes > 240) return true;

    // 3. Stalled Goals
    const hasStalledGoals = goals.some(g => g.progressPercent < 100);
    if (hasStalledGoals) return true;

    // 4. Broken Habit Streaks
    const hasBrokenHabitStreaks = habits.some(h => {
      if (h.streak > 0 && h.lastCompletedAt) {
        const lastDate = new Date(h.lastCompletedAt);
        const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        return h.frequency === 'daily' ? diffDays > 1.5 : diffDays > 8;
      }
      return false;
    });
    if (hasBrokenHabitStreaks) return true;

    return false;
  };

  const handleRunAutonomousAudit = async (force: boolean = false) => {
    if (!user || isAutonomousProcessing) return;

    // Check if we should skip running (e.g., if ran in the last 15 minutes and not forced)
    const nowTimestamp = Date.now();
    const lastRunStr = localStorage.getItem(`pulse_last_autonomous_run_${user.uid}`);
    if (lastRunStr && !force) {
      const lastRun = parseInt(lastRunStr);
      // Run every 15 minutes max unless forced
      if (nowTimestamp - lastRun < 15 * 60 * 1000) {
        return;
      }
    }

    // Check if there are actual productivity issues
    if (!detectProductivityIssues() && !force) {
      if (force) {
        showNotification("All systems in sync! No autonomous optimization needed.", "info");
      }
      return;
    }

    setIsAutonomousProcessing(true);
    localStorage.setItem(`pulse_last_autonomous_run_${user.uid}`, String(nowTimestamp));
    if (force) {
      showNotification("Pulse Autonomous Agent starting auditing...", "info");
    }

    try {
      let data;
      try {
        const response = await fetch("/api/autonomous/analyze-and-execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks,
            scheduleBlocks,
            goals,
            habits,
            currentTime: new Date().toISOString()
          })
        });
        data = await response.json();
      } catch (fetchError) {
        console.warn("Autonomous API fetch failed, running local backup analyzer:", fetchError);
        await runLocalAutonomousFallback();
        return;
      }

      if (!data || !data.success) {
        console.warn("Autonomous API failed, running local backup analyzer:", data?.error);
        await runLocalAutonomousFallback();
        return;
      }

      const actions = data.actions || [];
      const textResponse = data.textResponse || "";

      if (actions.length === 0) {
        setIsAutonomousProcessing(false);
        if (force) {
          showNotification("No optimizations needed at this moment.", "info");
        }
        return;
      }

      // We have actions! Keep track of old state for Undo
      const undoState: typeof autonomousUndoState = {
        originalTasks: [],
        originalBlocks: [],
        createdTaskIds: []
      };

      // We'll apply changes sequentially
      for (const action of actions) {
        const { type, params } = action;

        if (type === "reprioritize_tasks") {
          const updates = params.updates || [];
          for (const item of updates) {
            const task = tasks.find(t => t.id === item.taskId);
            if (task) {
              undoState.originalTasks.push({
                id: task.id,
                previous: { priorityScore: task.priorityScore, priorityReason: task.priorityReason || "" }
              });
              await handleUpdateTask(task.id, {
                priorityScore: item.priorityScore,
                priorityReason: item.priorityReason
              });
            }
          }
        } 
        
        else if (type === "reschedule_tasks") {
          const updates = params.updates || [];
          for (const item of updates) {
            const task = tasks.find(t => t.id === item.taskId);
            if (task) {
              undoState.originalTasks.push({
                id: task.id,
                previous: { deadline: task.deadline, priorityReason: task.priorityReason || "" }
              });
              await handleUpdateTask(task.id, {
                deadline: item.newDeadline,
                priorityReason: item.reason
              });
            }
          }
        } 
        
        else if (type === "move_schedule_blocks") {
          const updates = params.updates || [];
          for (const item of updates) {
            const block = scheduleBlocks.find(b => b.id === item.blockId);
            if (block) {
              undoState.originalBlocks.push({
                id: block.id,
                previous: { start: block.start, end: block.end }
              });
              await handleUpdateScheduleBlock(block.id, {
                start: item.newStart,
                end: item.newEnd
              });
            }
          }
        } 
        
        else if (type === "split_stalled_goal") {
          const newTaskId = isLocalMode 
            ? `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
            : doc(collection(db, 'tasks')).id;

          const newTaskData = {
            id: newTaskId,
            userId: user.uid,
            title: params.taskTitle,
            description: params.description || `Associated with stalled goal.`,
            category: params.category || "Work",
            estimatedMinutes: params.estimatedMinutes || 30,
            deadline: params.deadline,
            status: "todo" as const,
            priorityScore: 85,
            priorityReason: `Autonomously split from stalled goal to restart progress.`,
            createdAt: new Date().toISOString()
          };

          if (isLocalMode) {
            const updated = [...tasks, newTaskData];
            setTasks(updated);
            localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
          } else {
            await setDoc(doc(db, 'tasks', newTaskId), newTaskData);
          }
          undoState.createdTaskIds.push(newTaskId);
        } 
        
        else if (type === "draft_habit_recovery_plan") {
          const newTaskId = isLocalMode 
            ? `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
            : doc(collection(db, 'tasks')).id;

          const newTaskData = {
            id: newTaskId,
            userId: user.uid,
            title: params.taskTitle,
            description: params.description || `Recovery task for broken habit streak.`,
            category: "Habit",
            estimatedMinutes: 15,
            deadline: params.deadline,
            status: "todo" as const,
            priorityScore: 90,
            priorityReason: `Autonomously created to recover habit streak momentum.`,
            createdAt: new Date().toISOString()
          };

          if (isLocalMode) {
            const updated = [...tasks, newTaskData];
            setTasks(updated);
            localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
          } else {
            await setDoc(doc(db, 'tasks', newTaskId), newTaskData);
          }
          undoState.createdTaskIds.push(newTaskId);
        }
      }

      setAutonomousUndoState(undoState);
      setAutonomousActionExplanation(textResponse);
      setHasAutonomousAction(true);
      showNotification("Autonomous AI optimization complete!", "success");

    } catch (e) {
      console.error("Autonomous audit execution failed, running local backup:", e);
      await runLocalAutonomousFallback();
    } finally {
      setIsAutonomousProcessing(false);
    }
  };

  const handleUndoAutonomous = async () => {
    if (!user || !autonomousUndoState) return;

    try {
      // 1. Restore original tasks
      for (const item of autonomousUndoState.originalTasks) {
        await handleUpdateTask(item.id, item.previous);
      }

      // 2. Restore original blocks
      for (const item of autonomousUndoState.originalBlocks) {
        await handleUpdateScheduleBlock(item.id, item.previous);
      }

      // 3. Delete created tasks
      for (const taskId of autonomousUndoState.createdTaskIds) {
        if (isLocalMode) {
          const updated = tasks.filter(t => t.id !== taskId);
          setTasks(updated);
          localStorage.setItem(`pulse_tasks_${user.uid}`, JSON.stringify(updated));
        } else {
          await deleteDoc(doc(db, 'tasks', taskId));
        }
      }

      setAutonomousUndoState(null);
      setAutonomousActionExplanation(null);
      setHasAutonomousAction(false);
      showNotification("Autonomous AI actions reversed successfully!", "success");

    } catch (e) {
      console.error("Failed to undo autonomous action:", e);
      showNotification("Failed to undo some changes.", "error");
    }
  };

  // --- PERSONALIZED RECOMMENDATIONS FUNCTIONS ---
  const [isRefreshingRecommendations, setIsRefreshingRecommendations] = useState(false);

  const handleDismissRecommendation = async (recId: string) => {
    const updated = recommendations.map(r => r.id === recId ? { ...r, dismissed: true } : r);
    setRecommendations(updated);
    if (isLocalMode) {
      localStorage.setItem(`pulse_recs_${user.uid}`, JSON.stringify(updated));
    } else {
      try {
        await updateDoc(doc(db, 'recommendations', recId), { dismissed: true });
      } catch (err) {
        console.warn("Failed to update recommendation dismissal in Firestore:", err);
      }
    }
  };

  const handleRefreshRecommendations = async () => {
    if (!user) return;
    setIsRefreshingRecommendations(true);
    try {
      const response = await fetch("/api/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks,
          goals,
          habits,
          currentTime: new Date().toISOString()
        })
      });
      const data = await response.json();
      if (data.success && data.recommendations) {
        const newRecs = data.recommendations.map((rec: any, index: number) => ({
          id: `${user.uid}_rec_${Date.now()}_${index}`,
          userId: user.uid,
          title: rec.title,
          message: rec.message,
          category: rec.category,
          type: rec.type,
          createdAt: new Date().toISOString(),
          dismissed: false
        }));

        if (isLocalMode) {
          setRecommendations(newRecs);
          localStorage.setItem(`pulse_recs_${user.uid}`, JSON.stringify(newRecs));
        } else {
          // Clear old ones and write new ones in a single atomic batch to prevent flickering in real-time listeners
          const q = query(collection(db, 'recommendations'), where('userId', '==', user.uid));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.forEach((d) => {
            batch.delete(d.ref);
          });
          for (const newRec of newRecs) {
            batch.set(doc(db, 'recommendations', newRec.id), newRec);
          }
          await batch.commit();
        }
        showNotification("Productivity recommendations updated successfully!", "success");
      }
    } catch (err) {
      console.warn("Failed to generate recommendations:", err);
      showNotification("Failed to update recommendations. Check connection or engine.", "error");
    } finally {
      setIsRefreshingRecommendations(false);
    }
  };

  // Auto-refresh recommendations if none exist or they are older than 24 hours
  useEffect(() => {
    if (!user || authLoading) return;

    if (isFirstRecsMount.current) {
      isFirstRecsMount.current = false;
      return;
    }

    const lastCheck = localStorage.getItem(`pulse_last_rec_check_${user.uid}`);
    const now = Date.now();
    if (lastCheck && now - parseInt(lastCheck, 10) < 15 * 60 * 1000) {
      // Checked recently, skip
      return;
    }
    localStorage.setItem(`pulse_last_rec_check_${user.uid}`, String(now));

    const checkAndAutoRefresh = async () => {
      if (!isLocalMode && recommendations.length === 0) {
        // Sleep 2 seconds for onSnapshot sync
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      let needsRefresh = false;
      if (recommendations.length === 0) {
        needsRefresh = true;
      } else {
        const newest = [...recommendations].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (newest) {
          const hoursSinceCreation = (now - new Date(newest.createdAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceCreation >= 24) {
            needsRefresh = true;
          }
        }
      }

      if (needsRefresh && !isRefreshingRecommendations) {
        console.log("Auto-refreshing productivity recommendations...");
        handleRefreshRecommendations();
      }
    };

    checkAndAutoRefresh();
  }, [user, authLoading, recommendations.length]);

  // --- VIEW ROUTER ---
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            darkMode={darkMode}
            userProfile={userProfile}
            tasks={tasks}
            scheduleBlocks={scheduleBlocks}
            goals={goals}
            habits={habits}
            recommendations={recommendations}
            onRefreshRecommendations={handleRefreshRecommendations}
            onDismissRecommendation={handleDismissRecommendation}
            isRefreshingRecommendations={isRefreshingRecommendations}
            onAutoSchedule={handleAutoSchedule}
            onUndoSchedule={handleUndoSchedule}
            hasRecentScheduleAction={hasRecentScheduleAction}
            recentActionExplanation={recentActionExplanation}
            onNavigate={(tab) => setActiveTab(tab)}
            onCompleteTask={(taskId, done) => handleUpdateTask(taskId, { status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : undefined })}
            isLocalMode={isLocalMode}
            onPrioritizeAll={() => runTaskPrioritization(tasks)}
            isPrioritizing={isPrioritizing}
            onSaveProposedBlocks={handleSaveProposedBlocks}
            hasAutonomousAction={hasAutonomousAction}
            autonomousActionExplanation={autonomousActionExplanation}
            onUndoAutonomous={handleUndoAutonomous}
            onDismissAutonomous={() => {
              setHasAutonomousAction(false);
              setAutonomousActionExplanation(null);
            }}
            isAutonomousProcessing={isAutonomousProcessing}
            onTriggerAutonomous={() => handleRunAutonomousAudit(true)}
            onUpdateProfile={handleUpdateProfile}
          />
        );
      case 'tasks':
        return (
          <Tasks
            darkMode={darkMode}
            tasks={tasks}
            scheduleBlocks={scheduleBlocks}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onPrioritizeAll={() => runTaskPrioritization(tasks)}
            isPrioritizing={isPrioritizing}
          />
        );
      case 'goals_habits':
        return (
          <GoalsHabits
            darkMode={darkMode}
            goals={goals}
            habits={habits}
            onAddGoal={handleAddGoal}
            onUpdateGoal={handleUpdateGoal}
            onDeleteGoal={handleDeleteGoal}
            onAddHabit={handleAddHabit}
            onUpdateHabit={handleUpdateHabit}
            onDeleteHabit={handleDeleteHabit}
            onCompleteHabit={handleCompleteHabit}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            darkMode={darkMode}
            tasks={tasks}
            scheduleBlocks={scheduleBlocks}
            gcalEvents={gcalEvents}
            gcalSyncStatus={gcalSyncStatus}
            gcalLastSynced={gcalLastSynced}
            onSyncNow={() => triggerGCalSync()}
            onConnectGCal={handleConnectGCal}
            onCompleteTask={(taskId, done) => handleUpdateTask(taskId, { status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : undefined })}
            onDeleteTask={handleDeleteTask}
            onDeleteScheduleBlock={handleDeleteScheduleBlock}
          />
        );
      case 'settings':
        return (
          <Settings
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
          />
        );
      default:
        return <div className="text-center py-10">Select a valid tab</div>;
    }
  };

  // Main Authentication gate
  if (authLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 ${
        darkMode ? 'bg-[#1a1d24] text-white' : 'bg-[#e6ebf2] text-gray-800'
      }`}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-mono tracking-wider font-bold text-gray-400">LOADING PULSE COMPANION...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Onboarding darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Layout
      darkMode={darkMode}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      user={user}
      userProfile={userProfile}
      reminders={reminders}
      onDismissReminder={handleDismissReminder}
      onClearAllReminders={handleClearAllReminders}
      onLogout={handleLogout}
    >
      {notification && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm animate-fade-in">
          <div className={`p-4 rounded-2xl flex items-start justify-between gap-3 ${
            darkMode ? DESIGN_TOKENS.glass.dark : DESIGN_TOKENS.glass.light
          } ${
            notification.type === 'error'
              ? 'border-red-500/30 text-red-600 dark:text-red-400'
              : notification.type === 'success'
              ? 'border-green-500/30 text-green-600 dark:text-green-400'
              : 'border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
          }`}>
            <span className="font-sans font-medium text-sm leading-relaxed">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-xs font-bold hover:underline opacity-80 cursor-pointer ml-4 flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {renderTabContent()}
      <VoiceAssistant
        darkMode={darkMode}
        tasks={tasks}
        onAddTask={handleAddTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        habits={habits}
        goals={goals}
        onAddHabit={handleAddHabit}
        onCompleteHabit={handleCompleteHabit}
        onAddGoal={handleAddGoal}
        onDeleteHabit={handleDeleteHabit}
        onDeleteGoal={handleDeleteGoal}
        onClearAllReminders={handleClearAllReminders}
        showNotification={showNotification}
        userId={user?.uid}
      />
    </Layout>
  );
}
