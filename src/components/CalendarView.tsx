import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Task, ScheduleBlock, GCalEvent } from '../types';
import { NeumorphicContainer, NeumorphicButton, NeumorphicTabs } from './Neumorphic';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Video, 
  Plus, 
  Info,
  Layers,
  Sparkles,
  X,
  CheckSquare,
  Square,
  Trash2
} from 'lucide-react';

interface CalendarViewProps {
  darkMode: boolean;
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  gcalEvents: GCalEvent[];
  gcalSyncStatus: 'idle' | 'syncing' | 'success' | 'error' | 'not_connected';
  gcalLastSynced: string | null;
  onSyncNow: () => void;
  onConnectGCal: () => void;
  onCompleteTask?: (taskId: string, done: boolean) => void;
  onDeleteTask?: (taskId: string) => void;
  onDeleteScheduleBlock?: (id: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  darkMode,
  tasks,
  scheduleBlocks,
  gcalEvents,
  gcalSyncStatus,
  gcalLastSynced,
  onSyncNow,
  onConnectGCal,
  onCompleteTask,
  onDeleteTask,
  onDeleteScheduleBlock,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'month' | 'week'>('month');
  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    date: Date;
    tasks: Task[];
    blocks: ScheduleBlock[];
    gcalEvents: GCalEvent[];
  } | null>(null);

  // Days in month helper
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  // Array of days for rendering
  const monthDays: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    monthDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    monthDays.push(i);
  }

  const prevPeriod = () => {
    if (viewType === 'week') {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const nextPeriod = () => {
    if (viewType === 'week') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  // Find tasks due on a given day of the current month
  const getTasksForDay = (dayNum: number) => {
    return tasks.filter(task => {
      if (!task.deadline) return false;
      const tDate = new Date(task.deadline);
      return tDate.getFullYear() === year && tDate.getMonth() === month && tDate.getDate() === dayNum;
    });
  };

  // Find schedule blocks for a given day
  const getBlocksForDay = (dayNum: number) => {
    return scheduleBlocks.filter(block => {
      const bDate = new Date(block.start);
      return bDate.getFullYear() === year && bDate.getMonth() === month && bDate.getDate() === dayNum;
    });
  };

  // Find synced Google Calendar events for a given day
  const getGCalEventsForDay = (dayNum: number) => {
    return gcalEvents.filter(event => {
      const eDate = new Date(event.start);
      return eDate.getFullYear() === year && eDate.getMonth() === month && eDate.getDate() === dayNum;
    });
  };

  const getTaskTitle = (taskId: string) => {
    return tasks.find(t => t.id === taskId)?.title || 'Focus Session';
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Schedule Planner
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Keep visual tabs on focus sessions, scheduled blocks, and deadlines.
          </p>
        </div>

        {/* View Switch */}
        <div className="w-full sm:w-auto">
          <NeumorphicTabs
            id="calendar-view-type-select"
            darkMode={darkMode}
            options={[
              { id: 'month', label: 'Month' },
              { id: 'week', label: 'Week View' }
            ]}
            activeTab={viewType}
            onChange={(tabId) => setViewType(tabId as any)}
            className="w-full text-xs"
          />
        </div>
      </div>

      {/* Google Calendar Sync Control Panel */}
      <NeumorphicContainer darkMode={darkMode} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative" rounded="2xl">
        <div className="flex items-start gap-3">
          <Calendar className="w-6 h-6 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 flex-wrap">
              Google Calendar Sync
              {gcalSyncStatus === 'success' && (
                <span className="text-[10px] font-mono font-bold bg-green-500/15 text-green-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                  ● Connected & Synced
                </span>
              )}
              {gcalSyncStatus === 'syncing' && (
                <span className="text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-500 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  ● Syncing...
                </span>
              )}
              {gcalSyncStatus === 'error' && (
                <span className="text-[10px] font-mono font-bold bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full">
                  ● Sync Failed
                </span>
              )}
              {gcalSyncStatus === 'not_connected' && (
                <span className="text-[10px] font-mono font-bold bg-gray-500/15 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full">
                  ● Not Connected
                </span>
              )}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl leading-normal">
              {gcalSyncStatus === 'not_connected' 
                ? "Connect your Google Calendar to sync scheduled focus blocks in real-time and pull in your busy times to avoid double bookings."
                : `Pulse automatically syncs focus sessions with your calendar. We block out overlapping meetings during scheduling to keep you focused.`}
            </p>
            {gcalLastSynced && (
              <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                Last synced at {gcalLastSynced}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {gcalSyncStatus === 'not_connected' ? (
            <NeumorphicButton
              id="connect-gcal-button"
              darkMode={darkMode}
              variant="primary"
              onClick={onConnectGCal}
              className="text-xs py-1.5 px-4 font-bold rounded-xl"
            >
              Connect Calendar
            </NeumorphicButton>
          ) : (
            <div className="flex items-center gap-2">
              <NeumorphicButton
                id="sync-gcal-now-button"
                darkMode={darkMode}
                variant="secondary"
                onClick={onSyncNow}
                disabled={gcalSyncStatus === 'syncing'}
                className="text-xs py-1.5 px-4 font-bold rounded-xl flex items-center gap-1.5"
              >
                {gcalSyncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </NeumorphicButton>
            </div>
          )}
        </div>
      </NeumorphicContainer>

      {/* Calendar Grid Container */}
      <NeumorphicContainer darkMode={darkMode} className="p-6 space-y-6" rounded="3xl">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <Calendar className="w-5 h-5 text-indigo-500" />
            {viewType === 'week' ? (
              <span>
                Week of {new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth(),
                  currentDate.getDate() + (currentDate.getDay() === 0 ? -6 : 1 - currentDate.getDay())
                ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth(),
                  currentDate.getDate() + (currentDate.getDay() === 0 ? -6 : 1 - currentDate.getDay()) + 6
                ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            ) : (
              <span>{monthNames[month]} {year}</span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <NeumorphicButton
              id="calendar-prev-month"
              darkMode={darkMode}
              variant="secondary"
              onClick={prevPeriod}
              style={{ width: '59px' }}
              className="h-9 rounded-full flex items-center justify-center p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </NeumorphicButton>
            <NeumorphicButton
              id="calendar-next-month"
              darkMode={darkMode}
              variant="secondary"
              onClick={nextPeriod}
              style={{ width: '60px' }}
              className="h-9 rounded-full flex items-center justify-center p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </NeumorphicButton>
          </div>
        </div>

        {viewType === 'month' ? (
          <div className="space-y-2">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdayNames.map((name) => (
                <span key={name} className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 uppercase py-1">
                  {name}
                </span>
              ))}
            </div>

            {/* Grid days */}
            <div className="grid grid-cols-7 gap-3">
              {monthDays.map((day, idx) => {
                if (day === null) {
                  return (
                    <div key={`empty-${idx}`} className="aspect-square bg-transparent rounded-2xl opacity-20" />
                  );
                }

                const dayTasks = getTasksForDay(day);
                const dayBlocks = getBlocksForDay(day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

                return (
                  <div key={`day-${year}-${month}-${day}`} className="relative aspect-square min-h-[50px] sm:min-h-[90px]">
                    <NeumorphicContainer
                      darkMode={darkMode}
                      inset={isToday}
                      onClick={() => setSelectedDayDetails({
                        date: new Date(year, month, day),
                        tasks: dayTasks,
                        blocks: dayBlocks,
                        gcalEvents: getGCalEventsForDay(day)
                      })}
                      className={`h-full w-full p-1.5 sm:p-2 flex flex-col justify-between group border transition-all hover:scale-[1.02] cursor-pointer ${
                        isToday 
                          ? 'border-indigo-500/40 bg-indigo-500/[0.03]' 
                          : 'border-transparent'
                      }`}
                      rounded="2xl"
                    >
                      {/* Day Label */}
                      <span className={`text-xs font-mono font-bold ${
                        isToday ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {day}
                      </span>

                      {/* Overlays / Microdots */}
                      <div className="flex flex-wrap gap-1 justify-center md:block md:space-y-1 max-h-[55px] overflow-y-auto mt-1 scrollbar-none pr-0.5">
                        {dayBlocks.map((block) => (
                          <React.Fragment key={block.id}>
                            {/* Mobile visual dot */}
                            <span className="block md:hidden w-1.5 h-1.5 rounded-full bg-indigo-500" title={`Scheduled block: ${getTaskTitle(block.taskId)}`} />
                            {/* Desktop text badge */}
                            <div
                              className="hidden md:block text-[8px] sm:text-[9px] font-bold truncate leading-tight bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/10 rounded px-1 py-0.5"
                            >
                              🕒 {getTaskTitle(block.taskId)}
                            </div>
                          </React.Fragment>
                        ))}
                        {getGCalEventsForDay(day).map((event) => (
                          <React.Fragment key={event.id}>
                            {/* Mobile visual dot */}
                            <span className="block md:hidden w-1.5 h-1.5 rounded-full bg-emerald-500" title={`GCal Event: ${event.title}`} />
                            {/* Desktop text badge */}
                            <div
                              className="hidden md:block text-[8px] sm:text-[9px] font-bold truncate leading-tight bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 rounded px-1 py-0.5"
                            >
                              📅 {event.title} {event.isBusy ? '(Busy)' : ''}
                            </div>
                          </React.Fragment>
                        ))}
                        {dayTasks.map((task) => (
                          <React.Fragment key={task.id}>
                            {/* Mobile visual dot */}
                            <span className={`block md:hidden w-1.5 h-1.5 rounded-full ${task.status === 'done' ? 'bg-green-500' : 'bg-red-500'}`} title={`Task: ${task.title}`} />
                            {/* Desktop text badge */}
                            <div
                              className={`hidden md:block text-[8px] sm:text-[9px] font-bold truncate leading-tight border rounded px-1 py-0.5 ${
                                task.status === 'done'
                                  ? 'bg-green-500/10 text-green-500 border-green-500/10 line-through'
                                  : 'bg-red-500/10 text-red-500 border-red-500/10'
                              }`}
                            >
                              🎯 {task.title}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </NeumorphicContainer>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Week Agenda layout for a focused scheduling layout */
          <div className="space-y-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              Displaying chronological focus sessions and task deadlines for the upcoming week.
            </p>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                const date = new Date(currentDate);
                const currentDay = currentDate.getDay();
                const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
                date.setDate(currentDate.getDate() + distanceToMonday + dayOffset);
                const dTasks = tasks.filter(t => {
                  if (!t.deadline) return false;
                  const tDate = new Date(t.deadline);
                  return tDate.toDateString() === date.toDateString();
                });
                const dBlocks = scheduleBlocks.filter(b => {
                  const bDate = new Date(b.start);
                  return bDate.toDateString() === date.toDateString();
                });
                const dGCal = gcalEvents.filter(e => {
                  const eDate = new Date(e.start);
                  return eDate.toDateString() === date.toDateString();
                });

                return (
                  <div 
                    key={dayOffset} 
                    onClick={() => setSelectedDayDetails({
                      date: date,
                      tasks: dTasks,
                      blocks: dBlocks,
                      gcalEvents: dGCal
                    })}
                    className="flex flex-col sm:flex-row items-stretch gap-3 p-3 bg-gray-500/5 hover:bg-gray-500/10 transition-all duration-200 rounded-2xl cursor-pointer"
                  >
                    <div className="sm:w-28 flex-shrink-0 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-800 pb-2 sm:pb-0">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                        {date.toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                      <span className="text-lg font-extrabold text-gray-800 dark:text-gray-100">
                        {date.getDate()} {date.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                    </div>

                    <div className="flex-grow space-y-2">
                      {dBlocks.length === 0 && dTasks.length === 0 && dGCal.length === 0 ? (
                        <p className="text-xs text-gray-400 italic py-1">No scheduled blocks, targets, or calendar events for today.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {dBlocks.map(block => (
                            <div key={block.id} className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/10 text-xs font-semibold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="truncate">{new Date(block.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {getTaskTitle(block.taskId)}</span>
                            </div>
                          ))}
                          {dGCal.map(event => (
                            <div key={event.id} className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/10 text-xs font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="truncate">{new Date(event.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {event.title} {event.isBusy ? '(Busy)' : ''}</span>
                            </div>
                          ))}
                          {dTasks.map(task => (
                            <div key={task.id} className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                              task.status === 'done' 
                                ? 'bg-green-500/15 border-green-500/20 text-green-500 line-through' 
                                : 'bg-red-500/15 border-red-500/20 text-red-500'
                            }`}>
                              <span className="text-[10px] uppercase font-bold">Target</span>
                              <span className="truncate">{task.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </NeumorphicContainer>

      {/* Selected Day Details Modal overlay */}
      {selectedDayDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <NeumorphicContainer
              darkMode={darkMode}
              className="p-6 md:p-8 space-y-6"
              rounded="3xl"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedDayDetails.date.toLocaleDateString(undefined, { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      Daily agenda details & task overview
                    </p>
                  </div>
                </div>
                <NeumorphicButton
                  darkMode={darkMode}
                  onClick={() => setSelectedDayDetails(null)}
                  className="p-2 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </NeumorphicButton>
              </div>

              {/* Modal Content */}
              <div className="space-y-6">
                {/* 1. Focus Schedule Blocks Section */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Focus Blocks ({selectedDayDetails.blocks.length})
                  </h4>
                  {selectedDayDetails.blocks.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic bg-gray-500/5 p-3 rounded-2xl text-center">
                      No focus blocks scheduled for this day.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {selectedDayDetails.blocks.map((block) => {
                        const taskObj = tasks.find(t => t.id === block.taskId);
                        const bStart = new Date(block.start);
                        const bEnd = new Date(block.end);
                        const bDuration = Math.round((bEnd.getTime() - bStart.getTime()) / 60000);
                        return (
                          <div 
                            key={block.id} 
                            className="p-4 bg-indigo-500/[0.03] border border-indigo-500/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.05)]"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xs font-mono font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-xl flex-shrink-0 mt-0.5">
                                {bStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {bEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div>
                                <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                  {taskObj?.title || "Scheduled Focus Time"}
                                </h5>
                                {taskObj?.category && (
                                  <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full mt-1 inline-block">
                                    {taskObj.category}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <span className="text-xs font-mono text-gray-500 bg-gray-500/5 px-2 py-1 rounded-xl">
                                {bDuration} mins
                              </span>
                              {onDeleteScheduleBlock && (
                                <button
                                  id={`delete-schedule-block-${block.id}`}
                                  onClick={() => {
                                    onDeleteScheduleBlock(block.id);
                                    setSelectedDayDetails(prev => {
                                      if (!prev) return null;
                                      return {
                                        ...prev,
                                        blocks: prev.blocks.filter(b => b.id !== block.id)
                                      };
                                    });
                                  }}
                                  className="p-1.5 rounded-xl border transition-all duration-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 shadow-sm cursor-pointer flex-shrink-0"
                                  title="Remove Focus Block"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Google Calendar Events Section */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    Google Calendar Events ({selectedDayDetails.gcalEvents.length})
                  </h4>
                  {selectedDayDetails.gcalEvents.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic bg-gray-500/5 p-3 rounded-2xl text-center">
                      No Google Calendar events synchronized for this day.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {selectedDayDetails.gcalEvents.map((event) => {
                        const eStart = new Date(event.start);
                        const eEnd = new Date(event.end);
                        return (
                          <div 
                            key={event.id}
                            className="p-4 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-2xl flex items-center justify-between gap-3 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.05)]"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-xl">
                                {eStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {eEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div>
                                <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                  {event.title}
                                </h5>
                                {event.isBusy && (
                                  <span className="text-[9px] uppercase font-bold text-red-500 bg-red-500/10 border border-red-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                                    Busy Slot
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Task details section to complete */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                    Actionable Targets ({selectedDayDetails.tasks.length})
                  </h4>
                  {selectedDayDetails.tasks.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic bg-gray-500/5 p-3 rounded-2xl text-center">
                      No target deadlines for this day.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayDetails.tasks.map((task) => {
                        const isDone = task.status === 'done';
                        return (
                          <div 
                            key={task.id}
                            className={`p-4 rounded-2xl border transition-all duration-300 ${
                              isDone 
                                ? 'bg-green-500/[0.02] border-green-500/10 opacity-75' 
                                : 'bg-gray-500/5 border-gray-100 dark:border-gray-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-grow">
                                <button
                                  onClick={() => {
                                    if (onCompleteTask) {
                                      onCompleteTask(task.id, !isDone);
                                      // Real-time update state locally so the modal reflects instantly too!
                                      setSelectedDayDetails(prev => {
                                        if (!prev) return null;
                                        return {
                                          ...prev,
                                          tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: isDone ? 'todo' : 'done' } : t)
                                        };
                                      });
                                    }
                                  }}
                                  className={`p-1.5 rounded-xl border mt-0.5 transition-all duration-300 ${
                                    isDone 
                                      ? 'bg-green-500/10 border-green-500/30 text-green-500 shadow-[inset_0_2px_4px_rgba(34,197,94,0.1)]' 
                                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 hover:text-indigo-500 hover:border-indigo-500/30 shadow-sm'
                                  }`}
                                >
                                  {isDone ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                </button>
                                <div className="flex-grow">
                                  <h5 className={`text-sm font-bold ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {task.title}
                                  </h5>
                                  {task.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {task.description}
                                    </p>
                                  )}
                                  
                                  {/* Task Attributes */}
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {task.category && (
                                      <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                                        {task.category}
                                      </span>
                                    )}
                                    {task.priorityScore && (
                                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                        task.priorityScore >= 75 
                                          ? 'bg-rose-500/10 text-rose-500' 
                                          : task.priorityScore >= 40 
                                            ? 'bg-amber-500/10 text-amber-500' 
                                            : 'bg-green-500/10 text-green-500'
                                      }`}>
                                        Priority: {task.priorityScore}
                                      </span>
                                    )}
                                    {task.estimatedMinutes && (
                                      <span className="text-[10px] bg-gray-500/10 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full font-mono">
                                        ⏱️ {task.estimatedMinutes}m
                                      </span>
                                    )}
                                  </div>
 
                                  {task.priorityReason && (
                                    <div className="mt-2 text-[11px] text-indigo-500 bg-indigo-500/[0.02] border border-indigo-500/5 rounded-xl p-2 font-medium italic flex items-start gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5 animate-pulse" />
                                      <span>Pulse Rec: {task.priorityReason}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {onDeleteTask && (
                                <button
                                  id={`delete-calendar-task-${task.id}`}
                                  onClick={() => {
                                    onDeleteTask(task.id);
                                    setSelectedDayDetails(prev => {
                                      if (!prev) return null;
                                      return {
                                        ...prev,
                                        tasks: prev.tasks.filter(t => t.id !== task.id)
                                      };
                                    });
                                  }}
                                  className="p-1.5 rounded-xl border mt-0.5 transition-all duration-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 shadow-sm cursor-pointer flex-shrink-0"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Close */}
              <div className="pt-2">
                <NeumorphicButton
                  darkMode={darkMode}
                  onClick={() => setSelectedDayDetails(null)}
                  className="w-full py-3 font-semibold text-sm"
                  variant="primary"
                >
                  Done Exploring Agenda
                </NeumorphicButton>
              </div>
            </NeumorphicContainer>
          </div>
        </div>
      )}
    </div>
  );
};
