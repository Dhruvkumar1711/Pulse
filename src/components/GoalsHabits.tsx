import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Goal, Habit, Milestone } from '../types';
import { 
  NeumorphicContainer, 
  NeumorphicButton, 
  NeumorphicInput, 
  NeumorphicSelect,
  NeumorphicTabs,
  NeumorphicCheckbox,
  NeumorphicSlider,
  NeumorphicEmptyState,
  NeumorphicProgressBar
} from './Neumorphic';
import { 
  Plus, 
  Trash2, 
  Check, 
  Calendar, 
  Flame, 
  Target, 
  CheckSquare, 
  Square, 
  X, 
  CircleDot,
  TrendingUp,
  Award
} from 'lucide-react';

interface GoalsHabitsProps {
  darkMode: boolean;
  goals: Goal[];
  habits: Habit[];
  onAddGoal: (goal: Omit<Goal, 'id' | 'userId'>, aiBreakdown?: boolean) => void;
  onUpdateGoal: (id: string, updates: Partial<Goal>) => void;
  onDeleteGoal: (id: string) => void;
  onAddHabit: (habit: Omit<Habit, 'id' | 'userId' | 'streak'>) => void;
  onUpdateHabit: (id: string, updates: Partial<Habit>) => void;
  onDeleteHabit: (id: string) => void;
  onCompleteHabit: (id: string) => void;
}

export const GoalsHabits: React.FC<GoalsHabitsProps> = ({
  darkMode,
  goals,
  habits,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onCompleteHabit,
}) => {
  const [activeTab, setActiveTab] = useState<'goals' | 'habits'>('goals');
  
  // Modals state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);

  // Select to Delete states
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);

  const handleToggleSelectGoal = (id: string) => {
    setSelectedGoals(prev => 
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectHabit = (id: string) => {
    setSelectedHabits(prev => 
      prev.includes(id) ? prev.filter(hId => hId !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteGoals = () => {
    selectedGoals.forEach(id => onDeleteGoal(id));
    setSelectedGoals([]);
  };

  const handleBulkDeleteHabits = () => {
    selectedHabits.forEach(id => onDeleteHabit(id));
    setSelectedHabits([]);
  };

  const handleSelectAllGoals = () => {
    if (selectedGoals.length === goals.length) {
      setSelectedGoals([]);
    } else {
      setSelectedGoals(goals.map(g => g.id));
    }
  };

  const handleSelectAllHabits = () => {
    if (selectedHabits.length === habits.length) {
      setSelectedHabits([]);
    } else {
      setSelectedHabits(habits.map(h => h.id));
    }
  };

  // Reusable helper to handle gallery-like selection via long press, double click, and click-when-active
  const getCardSelectionProps = (id: string, type: 'goal' | 'habit') => {
    let pressTimer: any = null;
    let isLongPress = false;
    let startX = 0;
    let startY = 0;

    const startPress = (clientX: number, clientY: number) => {
      isLongPress = false;
      startX = clientX;
      startY = clientY;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        if (type === 'goal') {
          handleToggleSelectGoal(id);
        } else {
          handleToggleSelectHabit(id);
        }
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, 600);
    };

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        startPress(e.clientX, e.clientY);
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        // If it wasn't a long press and there's already a selection, single tap toggles it
        if (!isLongPress) {
          const hasSelection = type === 'goal' ? selectedGoals.length > 0 : selectedHabits.length > 0;
          if (hasSelection) {
            e.preventDefault();
            e.stopPropagation();
            if (type === 'goal') {
              handleToggleSelectGoal(id);
            } else {
              handleToggleSelectHabit(id);
            }
          }
        }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
        if (dist > 10) {
          cancelPress();
        }
      },
      onPointerCancel: cancelPress,
      onPointerLeave: cancelPress,
      onDoubleClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'goal') {
          handleToggleSelectGoal(id);
        } else {
          handleToggleSelectHabit(id);
        }
      }
    };
  };

  // New Goal form states
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [useAIBreakdown, setUseAIBreakdown] = useState(true);
  const [milestones, setMilestones] = useState<{ title: string; dueDate: string }[]>([
    { title: 'Define parameters', dueDate: '' }
  ]);

  // New Habit form states
  const [habitName, setHabitName] = useState('');
  const [habitFrequency, setHabitFrequency] = useState<'daily' | 'weekly'>('daily');

  // Add Milestone input helper
  const addMilestoneField = () => {
    setMilestones([...milestones, { title: '', dueDate: '' }]);
  };

  const removeMilestoneField = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneFieldChange = (index: number, field: 'title' | 'dueDate', value: string) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  // Submit Goal
  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    // Filter valid milestones
    const validMilestones: Milestone[] = milestones
      .filter(m => m.title.trim() !== '')
      .map(m => ({
        title: m.title.trim(),
        dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : new Date().toISOString(),
        done: false
      }));

    onAddGoal({
      title: goalTitle.trim(),
      targetDate: new Date(goalTargetDate || Date.now()).toISOString(),
      milestones: useAIBreakdown ? [] : validMilestones,
      progressPercent: 0,
    }, useAIBreakdown);

    // Reset
    setGoalTitle('');
    setGoalTargetDate('');
    setMilestones([{ title: 'Define parameters', dueDate: '' }]);
    setIsGoalModalOpen(false);
  };

  // Submit Habit
  const handleHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;

    onAddHabit({
      name: habitName.trim(),
      frequency: habitFrequency,
    });

    // Reset
    setHabitName('');
    setHabitFrequency('daily');
    setIsHabitModalOpen(false);
  };

  // Toggle single milestone completeness
  const handleToggleMilestone = (goal: Goal, milestoneIndex: number) => {
    const updatedMilestones = [...goal.milestones];
    updatedMilestones[milestoneIndex].done = !updatedMilestones[milestoneIndex].done;

    const completedCount = updatedMilestones.filter(m => m.done).length;
    const progressPercent = Math.round((completedCount / updatedMilestones.length) * 100);

    onUpdateGoal(goal.id, {
      milestones: updatedMilestones,
      progressPercent,
    });
  };

  // Check if habit was already completed today
  const isHabitCompletedToday = (habit: Habit) => {
    if (!habit.lastCompletedAt) return false;
    const lastDate = new Date(habit.lastCompletedAt).toDateString();
    const todayDate = new Date().toDateString();
    return lastDate === todayDate;
  };

  const formatTargetDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Tab Select & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Goals & Habits
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Set major objectives, trace milestones, and automate healthy routines.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="w-full sm:w-auto">
          <NeumorphicTabs
            id="goals-habits-tab-select"
            darkMode={darkMode}
            options={[
              { id: 'goals', label: 'Active Goals', icon: <Target className="w-4 h-4" /> },
              { id: 'habits', label: 'Habit Tracker', icon: <Flame className="w-4 h-4" /> }
            ]}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as any)}
            className="w-full text-xs"
          />
        </div>
      </div>

      {/* Main Content Pane */}
      <AnimatePresence mode="wait">
        {activeTab === 'goals' ? (
          <motion.div
            key="goals-pane"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Add Goal Panel Row */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                Active Objectives
              </h3>
              <NeumorphicButton
                id="add-goal-open-btn"
                darkMode={darkMode}
                variant="primary"
                onClick={() => setIsGoalModalOpen(true)}
                className="py-2.5 px-4 text-xs"
              >
                <Plus className="w-4 h-4" /> Create Goal
              </NeumorphicButton>
            </div>

            {/* Bulk actions for Goals */}
            {selectedGoals.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="flex flex-wrap items-center justify-between gap-3 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] p-3.5 rounded-2xl border border-indigo-500/10 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedGoals([])}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer"
                    title="Cancel selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSelectAllGoals}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-500 transition-all cursor-pointer"
                  >
                    {selectedGoals.length === goals.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span>{selectedGoals.length === goals.length ? 'Deselect All' : 'Select All Goals'}</span>
                  </button>
                  <span className="text-xs text-indigo-500 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">
                    {selectedGoals.length} Selected
                  </span>
                </div>
                {selectedGoals.length > 0 && (
                  <NeumorphicButton
                    id="bulk-delete-goals-btn"
                    darkMode={darkMode}
                    onClick={handleBulkDeleteGoals}
                    className="py-1.5 px-3 text-xs flex items-center gap-1.5 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Delete Selected ({selectedGoals.length})</span>
                  </NeumorphicButton>
                )}
              </motion.div>
            )}

            {goals.length > 0 && (
              <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 px-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>💡 Tip: Double-click or long-press an objective to select it. Select multiple to delete in bulk.</span>
              </div>
            )}

            {goals.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {goals.map((goal) => {
                  const isGoalSelected = selectedGoals.includes(goal.id);

                  return (
                    <NeumorphicContainer 
                      key={goal.id} 
                      darkMode={darkMode} 
                      className={`p-6 space-y-4 border-2 transition-all duration-300 relative select-none cursor-pointer ${
                        isGoalSelected 
                          ? 'border-indigo-500/30 bg-indigo-500/[0.015] shadow-lg shadow-indigo-500/[0.03]' 
                          : 'border-transparent hover:border-gray-200 dark:hover:border-gray-800'
                      }`} 
                      rounded="2xl"
                      {...getCardSelectionProps(goal.id, 'goal')}
                    >
                      {/* Gallery checkmark badge */}
                      {(isGoalSelected || selectedGoals.length > 0) && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectGoal(goal.id);
                          }}
                          className="absolute top-3.5 right-3.5 z-10 transition-all duration-300 scale-100 hover:scale-105"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            isGoalSelected 
                              ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' 
                              : 'bg-white/80 dark:bg-gray-800/80 border-gray-300 dark:border-gray-600 text-transparent hover:border-indigo-500'
                          }`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3">
                          <div>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white pr-6">
                              {goal.title}
                            </h4>
                            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-indigo-500" /> Target: {formatTargetDate(goal.targetDate)}
                            </span>
                          </div>
                        </div>
                      </div>

                    {/* Progress Bar */}
                    <NeumorphicProgressBar
                      value={goal.progressPercent}
                      darkMode={darkMode}
                      label="Milestone Progress"
                      showValueText={true}
                    />

                    {/* Milestones Checklist */}
                    <div className="space-y-2.5 pt-2">
                      <h5 className="text-[10px] font-bold uppercase font-mono text-gray-400 dark:text-gray-500">
                        Milestones Checklist ({goal.milestones.filter(m => m.done).length}/{goal.milestones.length})
                      </h5>
                      <div className="space-y-2">
                        {goal.milestones.map((milestone, idx) => (
                          <div
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMilestone(goal, idx);
                            }}
                            className="flex items-center gap-3 p-2 bg-gray-500/5 hover:bg-gray-500/10 rounded-xl transition-all duration-300 cursor-pointer"
                          >
                            <NeumorphicCheckbox
                              id={`milestone-${goal.id}-${idx}`}
                              checked={milestone.done}
                              onChange={() => {}} // click handler is on parent div to make touch target large
                              darkMode={darkMode}
                            />
                            <div className="flex-grow flex justify-between items-center gap-2">
                              <span className={`text-xs ${milestone.done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                                {milestone.title}
                              </span>
                              {milestone.dueDate && (
                                <span className="text-[9px] font-mono text-gray-400 whitespace-nowrap">
                                  by {new Date(milestone.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </NeumorphicContainer>
                )})}
              </div>
            ) : (
              <NeumorphicEmptyState
                title="No active goals yet"
                description="Outline your major hackathon deliverables or learning checkpoints and Pulse will track milestone progressions."
                ctaLabel="Create Your First Goal"
                onCtaClick={() => setIsGoalModalOpen(true)}
                icon={<Target className="w-16 h-16 text-indigo-500" />}
                darkMode={darkMode}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="habits-pane"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Add Habit Panel Row */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Flame className="w-5 h-5 text-indigo-500" />
                Habit Streak Trackers
              </h3>
              <NeumorphicButton
                id="add-habit-open-btn"
                darkMode={darkMode}
                variant="primary"
                onClick={() => setIsHabitModalOpen(true)}
                className="py-2.5 px-4 text-xs"
              >
                <Plus className="w-4 h-4" /> Create Habit
              </NeumorphicButton>
            </div>

            {/* Bulk actions for Habits */}
            {selectedHabits.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="flex flex-wrap items-center justify-between gap-3 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] p-3.5 rounded-2xl border border-indigo-500/10 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedHabits([])}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer"
                    title="Cancel selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSelectAllHabits}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-500 transition-all cursor-pointer"
                  >
                    {selectedHabits.length === habits.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span>{selectedHabits.length === habits.length ? 'Deselect All' : 'Select All Habits'}</span>
                  </button>
                  <span className="text-xs text-indigo-500 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">
                    {selectedHabits.length} Selected
                  </span>
                </div>
                {selectedHabits.length > 0 && (
                  <NeumorphicButton
                    id="bulk-delete-habits-btn"
                    darkMode={darkMode}
                    onClick={handleBulkDeleteHabits}
                    className="py-1.5 px-3 text-xs flex items-center gap-1.5 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Delete Selected ({selectedHabits.length})</span>
                  </NeumorphicButton>
                )}
              </motion.div>
            )}

            {habits.length > 0 && (
              <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 px-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>💡 Tip: Double-click or long-press a habit card to select it. Select multiple to delete in bulk.</span>
              </div>
            )}

            {habits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {habits.map((habit) => {
                  const completedToday = isHabitCompletedToday(habit);
                  const isHabitSelected = selectedHabits.includes(habit.id);
                  
                  // Generate monthly heatmap (last 30 days)
                  const monthlyDays = [];
                  for (let i = 29; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const yyyymmdd = d.toISOString().split('T')[0];
                    const dayLabel = d.getDate().toString();
                    const shortDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    monthlyDays.push({ yyyymmdd, dayLabel, shortDate });
                  }

                  return (
                    <NeumorphicContainer 
                      key={habit.id} 
                      darkMode={darkMode} 
                      className={`p-5 flex flex-col justify-between border-2 transition-all duration-300 relative select-none cursor-pointer ${
                        isHabitSelected 
                          ? 'border-indigo-500/30 bg-indigo-500/[0.015] shadow-lg shadow-indigo-500/[0.03]' 
                          : 'border-transparent hover:border-gray-200 dark:hover:border-gray-800'
                      }`} 
                      rounded="2xl"
                      {...getCardSelectionProps(habit.id, 'habit')}
                    >
                      {/* Gallery checkmark badge */}
                      {(isHabitSelected || selectedHabits.length > 0) && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectHabit(habit.id);
                          }}
                          className="absolute top-3.5 right-3.5 z-10 transition-all duration-300 scale-100 hover:scale-105"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            isHabitSelected 
                              ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' 
                              : 'bg-white/80 dark:bg-gray-800/80 border-gray-300 dark:border-gray-600 text-transparent hover:border-indigo-500'
                          }`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-start gap-3">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white capitalize pr-6">
                                {habit.name}
                              </h4>
                              <span className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400 uppercase tracking-wide font-bold">
                                {habit.frequency}
                              </span>
                            </div>
                          </div>
                        </div>
 
                        {/* Streak Badge */}
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-xl h-fit w-fit"
                        >
                          <Flame className={`w-5 h-5 ${habit.streak > 0 ? 'text-amber-500 animate-bounce' : 'text-gray-400 dark:text-gray-600'}`} />
                          <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                            Streak: {habit.streak} {habit.streak === 1 ? 'day' : 'days'}
                          </span>
                        </div>

                        {/* Monthly Heatmap */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[9px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                            Monthly Heatmap
                          </span>
                          <div className="grid grid-cols-10 gap-0.5 p-1.5 bg-gray-500/5 rounded-xl border border-gray-500/5">
                            {monthlyDays.map((day) => {
                              const isCompleted = Array.isArray(habit.completedDates) && habit.completedDates.includes(day.yyyymmdd);
                              return (
                                <div
                                  key={day.yyyymmdd}
                                  onClick={(e) => e.stopPropagation()}
                                  title={`${day.shortDate}: ${isCompleted ? 'Completed!' : 'Not completed'}`}
                                  className={`h-5 rounded flex flex-col items-center justify-center text-[7px] font-bold font-mono transition-all duration-300 select-none cursor-help ${
                                    isCompleted
                                      ? 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                                      : darkMode
                                        ? 'bg-[#1b2028] text-gray-500 border border-gray-800'
                                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                                  }`}
                                >
                                  <span>{day.dayLabel}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800/40 flex items-center justify-between gap-3">
                        <span className="text-[9px] text-gray-400 font-mono">
                          {habit.lastCompletedAt ? `Last: ${new Date(habit.lastCompletedAt).toLocaleDateString()}` : 'Never completed yet'}
                        </span>
                        
                        <NeumorphicButton
                          id={`complete-habit-btn-${habit.id}`}
                          darkMode={darkMode}
                          variant={completedToday ? 'secondary' : 'primary'}
                          disabled={completedToday}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCompleteHabit(habit.id);
                          }}
                          className={`py-1.5 px-3.5 text-xs rounded-xl flex items-center gap-1 cursor-pointer`}
                        >
                          {completedToday ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Done Today
                            </>
                          ) : (
                            <>Mark Done</>
                          )}
                        </NeumorphicButton>
                      </div>
                    </NeumorphicContainer>
                  );
                })}
              </div>
            ) : (
              <NeumorphicEmptyState
                title="No habits tracked"
                description="Routines generate focus. Set daily triggers like 'Review Backlog' or 'Code 1 Hour' and build your productivity streak."
                ctaLabel="Track a Routine"
                onCtaClick={() => setIsHabitModalOpen(true)}
                icon={<Flame className="w-16 h-16 text-indigo-500" />}
                darkMode={darkMode}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goal Creation Modal */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGoalModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg z-10"
            >
              <NeumorphicContainer darkMode={darkMode} className="p-6 md:p-8" rounded="3xl">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
                    Create New Goal
                  </h3>
                  <button
                    id="close-goal-modal"
                    onClick={() => setIsGoalModalOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-500/10 text-gray-500 dark:text-gray-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleGoalSubmit} className="space-y-4">
                  {/* Goal Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                      Goal / Objective
                    </label>
                    <NeumorphicInput
                      id="form-goal-title"
                      darkMode={darkMode}
                      type="text"
                      placeholder="e.g. Build Pulse MVP App"
                      value={goalTitle}
                      onChange={(e) => setGoalTitle(e.target.value)}
                      required
                    />
                  </div>

                  {/* Target Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                      Target Completion Date
                    </label>
                    <NeumorphicInput
                      id="form-goal-targetdate"
                      darkMode={darkMode}
                      type="date"
                      value={goalTargetDate}
                      onChange={(e) => setGoalTargetDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* AI Breakdown Toggle */}
                  <div className="flex items-center gap-3 p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                    <NeumorphicCheckbox
                      id="ai-breakdown-checkbox"
                      checked={useAIBreakdown}
                      onChange={setUseAIBreakdown}
                      darkMode={darkMode}
                    />
                    <div className="flex-1">
                      <label htmlFor="ai-breakdown-checkbox" className="text-xs font-bold text-gray-800 dark:text-gray-200 block cursor-pointer">
                        ✨ Automate Breakdown with Gemini AI
                      </label>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Automatically break this goal into 3 strategic milestones and create linked task checklists.
                      </p>
                    </div>
                  </div>

                  {/* Milestones Fields */}
                  {!useAIBreakdown ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono flex justify-between items-center">
                        <span>Breakdown Milestones</span>
                        <button
                          type="button"
                          id="add-milestone-field-btn"
                          onClick={addMilestoneField}
                          className="text-xs text-indigo-500 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </label>

                      <div className="max-h-[160px] overflow-y-auto space-y-3 pr-1">
                        {milestones.map((milestone, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <NeumorphicInput
                              id={`milestone-title-input-${idx}`}
                              darkMode={darkMode}
                              type="text"
                              placeholder="Milestone title..."
                              value={milestone.title}
                              onChange={(e) => handleMilestoneFieldChange(idx, 'title', e.target.value)}
                              required={!useAIBreakdown}
                              className="text-xs py-2"
                            />
                            <NeumorphicInput
                              id={`milestone-date-input-${idx}`}
                              darkMode={darkMode}
                              type="date"
                              value={milestone.dueDate}
                              onChange={(e) => handleMilestoneFieldChange(idx, 'dueDate', e.target.value)}
                              className="text-xs py-2 w-[140px]"
                            />
                            {milestones.length > 1 && (
                              <button
                                type="button"
                                id={`remove-milestone-field-${idx}`}
                                onClick={() => removeMilestoneField(idx)}
                                className="text-red-500 hover:text-red-700 p-2 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-500/5 rounded-2xl text-center border border-gray-500/10">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                        🤖 AI will auto-schedule milestones and generate action-oriented task cards on submission.
                      </span>
                    </div>
                  )}

                  {/* Submit buttons */}
                  <div className="pt-4 flex gap-3">
                    <NeumorphicButton
                      id="form-goal-cancel"
                      type="button"
                      darkMode={darkMode}
                      variant="secondary"
                      onClick={() => setIsGoalModalOpen(false)}
                      className="flex-1 py-3"
                    >
                      Cancel
                    </NeumorphicButton>
                    <NeumorphicButton
                      id="form-goal-submit"
                      type="submit"
                      darkMode={darkMode}
                      variant="primary"
                      className="flex-1 py-3"
                    >
                      Create Goal
                    </NeumorphicButton>
                  </div>
                </form>
              </NeumorphicContainer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Habit Creation Modal */}
      <AnimatePresence>
        {isHabitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHabitModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md z-10"
            >
              <NeumorphicContainer darkMode={darkMode} className="p-6 md:p-8" rounded="3xl">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
                    Create New Habit
                  </h3>
                  <button
                    id="close-habit-modal"
                    onClick={() => setIsHabitModalOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-500/10 text-gray-500 dark:text-gray-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleHabitSubmit} className="space-y-4">
                  {/* Habit Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                      Habit Name
                    </label>
                    <NeumorphicInput
                      id="form-habit-name"
                      darkMode={darkMode}
                      type="text"
                      placeholder="e.g. Backlog Grooming, Review code"
                      value={habitName}
                      onChange={(e) => setHabitName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Frequency */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                      Target Frequency
                    </label>
                    <NeumorphicSelect
                      id="form-habit-frequency"
                      darkMode={darkMode}
                      value={habitFrequency}
                      onChange={(e) => setHabitFrequency(e.target.value as any)}
                      className="w-full text-sm py-2.5"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </NeumorphicSelect>
                  </div>

                  {/* Submit buttons */}
                  <div className="pt-4 flex gap-3">
                    <NeumorphicButton
                      id="form-habit-cancel"
                      type="button"
                      darkMode={darkMode}
                      variant="secondary"
                      onClick={() => setIsHabitModalOpen(false)}
                      className="flex-1 py-3"
                    >
                      Cancel
                    </NeumorphicButton>
                    <NeumorphicButton
                      id="form-habit-submit"
                      type="submit"
                      darkMode={darkMode}
                      variant="primary"
                      className="flex-1 py-3"
                    >
                      Create Habit
                    </NeumorphicButton>
                  </div>
                </form>
              </NeumorphicContainer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
