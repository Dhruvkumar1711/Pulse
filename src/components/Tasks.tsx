import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, ScheduleBlock } from '../types';
import { 
  NeumorphicContainer, 
  NeumorphicButton, 
  NeumorphicInput, 
  NeumorphicTextArea, 
  NeumorphicSelect,
  NeumorphicTabs,
  NeumorphicCheckbox,
  NeumorphicSlider,
  NeumorphicEmptyState
} from './Neumorphic';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Check, 
  Clock, 
  Calendar, 
  Sparkles, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface TasksProps {
  darkMode: boolean;
  tasks: Task[];
  scheduleBlocks?: ScheduleBlock[];
  onAddTask: (task: Omit<Task, 'id' | 'userId' | 'createdAt'>) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onPrioritizeAll?: () => void;
  isPrioritizing?: boolean;
}

export const Tasks: React.FC<TasksProps> = ({
  darkMode,
  tasks,
  scheduleBlocks = [],
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onPrioritizeAll,
  isPrioritizing,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [pulsingTasks, setPulsingTasks] = useState<Record<string, boolean>>({});
  const [inlineTitle, setInlineTitle] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    unplanned: false,
    scheduled: false,
    done: false
  });

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [category, setCategory] = useState('Work');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [priorityScore, setPriorityScore] = useState(50);

  const categories = ['all', 'Work', 'Personal', 'Study', 'Health', 'Finance', 'Hackathon'];

  // Handle modal open for create
  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    // Default deadline to tomorrow at 5 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    // Format to datetime-local local string: YYYY-MM-DDTHH:MM
    const tzoffset = tomorrow.getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = (new Date(tomorrow.getTime() - tzoffset)).toISOString().slice(0, 16);
    setDeadline(localISOTime);
    setEstimatedMinutes(45);
    setCategory('Work');
    setStatus('todo');
    setPriorityScore(50);
    setIsModalOpen(true);
  };

  // Handle modal open for edit
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    // If deadline has timezone info, parse nicely
    const dateObj = new Date(task.deadline);
    const tzoffset = dateObj.getTimezoneOffset() * 60000;
    const formatted = (new Date(dateObj.getTime() - tzoffset)).toISOString().slice(0, 16);
    setDeadline(formatted);
    setEstimatedMinutes(task.estimatedMinutes);
    setCategory(task.category);
    setStatus(task.status);
    setPriorityScore(task.priorityScore);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      deadline: new Date(deadline).toISOString(),
      estimatedMinutes: Number(estimatedMinutes),
      category,
      status,
      priorityScore: Number(priorityScore),
    };

    if (editingTask) {
      onUpdateTask(editingTask.id, taskData);
    } else {
      onAddTask(taskData);
    }
    setIsModalOpen(false);
  };

  const handleInlineAddSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!inlineTitle.trim()) return;
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);

      onAddTask({
        title: inlineTitle.trim(),
        description: '',
        deadline: tomorrow.toISOString(),
        estimatedMinutes: 45,
        category: filterCategory !== 'all' ? filterCategory : 'Work',
        status: 'todo',
        priorityScore: 50,
      });

      setInlineTitle('');
    }
  };

  // Get active tasks list with sorting and filtering
  const filteredTasks = tasks
    .filter(task => {
      const matchSearch = task.title.toLowerCase().includes(search.toLowerCase()) || 
                          task.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchCategory = filterCategory === 'all' || task.category === filterCategory;
      return matchSearch && matchStatus && matchCategory;
    })
    // Sort primarily by priority score descending, then by deadline ascending
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      
      const priorityDiff = b.priorityScore - a.priorityScore;
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

  const scheduledTaskIds = new Set((scheduleBlocks || []).map(b => b.taskId));

  const unplannedTasks = filteredTasks.filter(t => t.status !== 'done' && !scheduledTaskIds.has(t.id));
  const scheduledTasks = filteredTasks.filter(t => t.status !== 'done' && scheduledTaskIds.has(t.id));
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  const getPriorityColor = (score: number) => {
    if (score >= 75) return 'text-red-500 bg-red-500/10 dark:text-red-400';
    if (score >= 40) return 'text-amber-500 bg-amber-500/10 dark:text-amber-400';
    return 'text-green-500 bg-green-500/10 dark:text-green-400';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 75) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  const formatDeadlineDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const renderTaskSection = (title: string, sectionKey: 'unplanned' | 'scheduled' | 'done', taskList: Task[]) => {
    const isCollapsed = collapsedSections[sectionKey];
    return (
      <div className="space-y-4">
        {/* Section Header */}
        <button
          onClick={() => setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/40 dark:bg-[#1a1d24]/40 shadow-sm hover:bg-gray-500/5 transition-all text-left cursor-pointer border border-gray-100 dark:border-gray-800/30"
        >
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${
              sectionKey === 'unplanned' 
                ? 'bg-amber-500' 
                : sectionKey === 'scheduled'
                ? 'bg-indigo-500'
                : 'bg-green-500'
            }`} />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
              {title}
            </h3>
            <span className="text-[11px] font-mono font-bold bg-gray-500/10 text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full">
              {taskList.length}
            </span>
          </div>
          <div className="text-gray-400">
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </button>

        {/* Section Content */}
        {!isCollapsed && (
          <div className="pl-1 sm:pl-2">
            {taskList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnimatePresence mode="popLayout">
                  {taskList.map((task) => {
                    const priorityClass = getPriorityColor(task.priorityScore);
                    const priorityLabel = getPriorityLabel(task.priorityScore);
                    const isCompleted = task.status === 'done';

                    const isPulsing = pulsingTasks[task.id];

                    return (
                      <motion.div
                        key={task.id}
                        layoutId={task.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ 
                          opacity: 1, 
                          scale: isPulsing ? [1, 1.05, 0.95, 1] : 1 
                        }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ 
                          duration: isPulsing ? 0.4 : 0.2,
                          times: isPulsing ? [0, 0.3, 0.7, 1] : undefined
                        }}
                      >
                        <NeumorphicContainer
                          darkMode={darkMode}
                          className={`p-6 flex flex-col justify-between h-full relative overflow-hidden group border transition-all duration-300 ${
                            isCompleted 
                              ? 'border-green-500/10 bg-green-500/[0.01]' 
                              : 'border-transparent'
                          }`}
                          rounded="2xl"
                        >
                          <div>
                            {/* Priority and Category Badge Header */}
                            <div className="flex justify-between items-start gap-2 mb-3">
                              <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full capitalize">
                                {task.category}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {task.priorityReason && (
                                  <div className="relative group/reason">
                                    <div className="flex items-center gap-1 text-[10px] font-medium bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded-full cursor-help hover:bg-indigo-500/20 transition-all">
                                      <Sparkles className="w-2.5 h-2.5" />
                                      <span>AI Advice</span>
                                    </div>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover/reason:block group-focus/reason:block z-35 w-64 p-2.5 text-[11px] leading-relaxed font-sans text-gray-700 dark:text-gray-200 bg-white dark:bg-[#202530] rounded-xl shadow-md border border-gray-100 dark:border-gray-800 pointer-events-none transition-all duration-200 normal-case">
                                      <div className="font-bold text-indigo-500 dark:text-indigo-400 mb-0.5 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        AI Prioritization Reasoning:
                                      </div>
                                      <p className="font-medium text-gray-600 dark:text-gray-300">{task.priorityReason}</p>
                                    </div>
                                  </div>
                                )}
                                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityClass}`}>
                                  {priorityLabel} ({task.priorityScore})
                                </span>
                                <span className={`w-2.5 h-2.5 rounded-full ${
                                  task.status === 'done' 
                                    ? 'bg-green-500' 
                                    : task.status === 'in_progress'
                                    ? 'bg-amber-500'
                                    : 'bg-indigo-500'
                                }`} />
                              </div>
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-2">
                              <h3 className={`text-base font-bold tracking-tight text-gray-900 dark:text-white transition-all ${
                                isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''
                              }`}>
                                {task.title}
                              </h3>
                              <p className={`text-xs leading-relaxed text-gray-500 dark:text-gray-400 font-sans ${
                                expandedTasks[task.id] ? '' : 'line-clamp-3'
                              } ${
                                isCompleted ? 'text-gray-400/80 dark:text-gray-500/80' : ''
                              }`}>
                                {task.description || 'No description provided.'}
                              </p>

                              {task.priorityReason && !expandedTasks[task.id] && (
                                <div className="mt-2.5 p-2 rounded-xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/20 flex items-start gap-2">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0 animate-pulse" />
                                  <p className="text-[11px] leading-relaxed text-indigo-600 dark:text-indigo-300 font-sans font-medium">
                                    <span className="font-bold text-indigo-500 dark:text-indigo-400">AI Advice: </span>{task.priorityReason}
                                  </p>
                                </div>
                              )}

                              <AnimatePresence>
                                {expandedTasks[task.id] && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/40 space-y-2.5 text-[11px] text-gray-500 dark:text-gray-400 font-sans"
                                  >
                                    <div className="flex justify-between items-center bg-gray-500/5 dark:bg-gray-500/10 p-2 rounded-xl">
                                      <span className="font-semibold text-gray-600 dark:text-gray-400">Created At:</span>
                                      <span className="font-mono text-gray-700 dark:text-gray-300">
                                        {task.createdAt ? new Date(task.createdAt).toLocaleString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: false
                                        }) : 'N/A'}
                                      </span>
                                    </div>
                                    {task.completedAt && (
                                      <div className="flex justify-between items-center bg-green-500/5 dark:bg-green-500/10 p-2 rounded-xl text-green-600 dark:text-green-400">
                                        <span className="font-semibold">Completed At:</span>
                                        <span className="font-mono">
                                          {new Date(task.completedAt).toLocaleString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: false
                                          })}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center bg-gray-500/5 dark:bg-gray-500/10 p-2 rounded-xl">
                                      <span className="font-semibold text-gray-600 dark:text-gray-400">Estimated Effort:</span>
                                      <span className="text-gray-700 dark:text-gray-300 font-mono">{task.estimatedMinutes} mins</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-500/5 dark:bg-gray-500/10 p-2 rounded-xl">
                                      <span className="font-semibold text-gray-600 dark:text-gray-400">Category & Status:</span>
                                      <span className="text-gray-700 dark:text-gray-300 capitalize">{task.category} • {task.status.replace('_', ' ')}</span>
                                    </div>
                                    {task.priorityReason && (
                                      <div className="bg-indigo-500/5 dark:bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                        <span className="font-bold flex items-center gap-1 mb-1 text-[10px] uppercase tracking-wider font-mono">
                                          <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Priority Reasoning
                                        </span>
                                        <p className="leading-relaxed font-sans font-medium text-xs text-gray-700 dark:text-gray-300">{task.priorityReason}</p>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {/* Timeline and Action Bar */}
                          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800/40 flex items-center justify-between gap-4">
                            <div className="flex flex-col space-y-1 text-gray-400 dark:text-gray-500">
                              <span className="text-[10px] font-mono flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-indigo-500" />
                                {formatDeadlineDate(task.deadline)}
                              </span>
                              <span className="text-[10px] font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3 text-indigo-500" />
                                Est: {task.estimatedMinutes} mins
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                id={`expand-task-${task.id}`}
                                onClick={() => toggleExpand(task.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer mr-1 border ${
                                  expandedTasks[task.id]
                                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                                    : darkMode
                                    ? 'bg-[#181a20] text-gray-400 border-gray-800/80 hover:text-white hover:bg-gray-800/20'
                                    : 'bg-[#f4f7fa] text-gray-600 border-gray-200/80 hover:text-gray-900 hover:bg-gray-100'
                                }`}
                              >
                                <span>{expandedTasks[task.id] ? 'Hide' : 'Details'}</span>
                                {expandedTasks[task.id] ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>

                              {/* Complete Task checkbox */}
                              <NeumorphicCheckbox
                                id={`complete-task-${task.id}`}
                                checked={isCompleted}
                                onChange={(checked) => {
                                  if (checked) {
                                    setPulsingTasks((prev) => ({ ...prev, [task.id]: true }));
                                    setTimeout(() => {
                                      setPulsingTasks((prev) => ({ ...prev, [task.id]: false }));
                                    }, 400);
                                    onUpdateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
                                  }
                                }}
                                darkMode={darkMode}
                                disabled={isCompleted}
                              />

                              {/* Edit task button */}
                              {!isCompleted && (
                                <button
                                  id={`edit-task-btn-${task.id}`}
                                  onClick={() => openEditModal(task)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-500/10 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete task button */}
                              <button
                                id={`delete-task-btn-${task.id}`}
                                onClick={() => onDeleteTask(task.id)}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/10 text-red-500 dark:text-red-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </NeumorphicContainer>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 bg-gray-500/5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-sm font-medium">
                No tasks in this section.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Your Tasks
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Keep track of deadlines, allocate priorities, and focus on execution.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {onPrioritizeAll && (
            <NeumorphicButton
              id="re-prioritize-btn"
              darkMode={darkMode}
              onClick={onPrioritizeAll}
              disabled={isPrioritizing}
              className="py-3 px-4 text-sm flex items-center gap-1.5"
            >
              <Sparkles className={`w-4 h-4 text-indigo-500 ${isPrioritizing ? 'animate-spin' : ''}`} />
              {isPrioritizing ? 'AI Prioritizing...' : 'Re-prioritize now'}
            </NeumorphicButton>
          )}
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Search */}
        <div className="md:col-span-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <NeumorphicInput
              id="task-search-input"
              darkMode={darkMode}
              type="text"
              placeholder="Search tasks by keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 py-2.5 text-sm"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="md:col-span-5">
          <NeumorphicTabs
            id="task-filter-status"
            darkMode={darkMode}
            options={[
              { id: 'all', label: 'All' },
              { id: 'todo', label: 'To Do' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'done', label: 'Done' }
            ]}
            activeTab={filterStatus}
            onChange={(tabId) => setFilterStatus(tabId as any)}
            className="w-full text-xs"
          />
        </div>

        {/* Category Filter dropdown */}
        <div className="md:col-span-3">
          <div className="relative flex items-center">
            <Filter className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
            <NeumorphicSelect
              id="filter-category-select"
              darkMode={darkMode}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-10 py-2 text-sm w-full capitalize"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </NeumorphicSelect>
          </div>
        </div>
      </div>

      {/* Lightweight Inline Quick Add */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-indigo-500">
          <Plus className="w-5 h-5" />
        </span>
        <NeumorphicInput
          id="inline-add-task-input"
          darkMode={darkMode}
          type="text"
          placeholder="+ Add task, press Enter to save..."
          value={inlineTitle}
          onChange={(e) => setInlineTitle(e.target.value)}
          onKeyDown={handleInlineAddSubmit}
          className="pl-12 py-3.5 text-sm w-full font-semibold"
        />
      </div>

      {/* Task Cards Sections */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-6">
          {renderTaskSection('Unplanned Tasks', 'unplanned', unplannedTasks)}
          {renderTaskSection('Scheduled Tasks', 'scheduled', scheduledTasks)}
          {renderTaskSection('Completed Tasks', 'done', doneTasks)}
        </div>
      ) : (
        <NeumorphicEmptyState
          title="No matching tasks found"
          description="You can try clearing filters, adjusting search queries, or type above and hit Enter to add your first task!"
          ctaLabel="Quick Add a Task"
          onCtaClick={() => {
            const inputEl = document.getElementById('inline-add-task-input');
            if (inputEl) inputEl.focus();
          }}
          icon={<CheckCircle2 className="w-16 h-16 text-indigo-500" />}
          darkMode={darkMode}
        />
      )}

      {/* Task Creator / Editor Modal Drawer */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg z-10"
            >
              <NeumorphicContainer darkMode={darkMode} className="p-6 md:p-8" rounded="3xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
                    {editingTask ? 'Edit Task Details' : 'Add New Task'}
                  </h3>
                  <button
                    id="close-task-modal-btn"
                    onClick={() => setIsModalOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-500/10 text-gray-500 dark:text-gray-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                      Task Title
                    </label>
                    <NeumorphicInput
                      id="form-task-title"
                      darkMode={darkMode}
                      type="text"
                      placeholder="e.g. Complete hackathon pitch presentation"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                      Description
                    </label>
                    <NeumorphicTextArea
                      id="form-task-desc"
                      darkMode={darkMode}
                      rows={3}
                      placeholder="e.g. Create the slidedeck, add product wireframe links, and detail Firestore models for Pulse."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {/* Category and Estimated Minutes */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                        Category
                      </label>
                      <NeumorphicSelect
                        id="form-task-category"
                        darkMode={darkMode}
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full text-sm py-2.5"
                      >
                        {categories.filter(c => c !== 'all').map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </NeumorphicSelect>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                        Minutes Est.
                      </label>
                      <NeumorphicInput
                        id="form-task-minutes"
                        darkMode={darkMode}
                        type="number"
                        min={5}
                        max={480}
                        value={estimatedMinutes}
                        onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                        required
                        className="py-2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Deadline Datepicker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                      Target Deadline
                    </label>
                    <NeumorphicInput
                      id="form-task-deadline"
                      darkMode={darkMode}
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      required
                    />
                  </div>

                  {/* Priority & Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono flex items-center justify-between">
                        <span>Priority ({priorityScore})</span>
                        <span className={`text-[10px] font-mono font-bold ${
                          priorityScore >= 75 ? 'text-red-500' : priorityScore >= 40 ? 'text-amber-500' : 'text-green-500'
                        }`}>
                          {getPriorityLabel(priorityScore)}
                        </span>
                      </label>
                      <NeumorphicSlider
                        id="form-task-priority"
                        min={1}
                        max={100}
                        value={priorityScore}
                        onChange={setPriorityScore}
                        darkMode={darkMode}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                        Task Status
                      </label>
                      <NeumorphicSelect
                        id="form-task-status"
                        darkMode={darkMode}
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        disabled={editingTask?.status === 'done'}
                        className="w-full text-sm py-2.5 disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done / Complete</option>
                      </NeumorphicSelect>
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div className="pt-4 flex gap-3">
                    <NeumorphicButton
                      id="form-task-cancel"
                      type="button"
                      darkMode={darkMode}
                      variant="secondary"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-3"
                    >
                      Cancel
                    </NeumorphicButton>
                    <NeumorphicButton
                      id="form-task-submit"
                      type="submit"
                      darkMode={darkMode}
                      variant="primary"
                      className="flex-1 py-3"
                    >
                      {editingTask ? 'Save Task' : 'Create Task'}
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
