import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  CheckSquare, 
  Target, 
  Calendar, 
  Settings as SettingsIcon,
  Zap,
  LogOut,
  User,
  Flame,
  Bell,
  BellRing,
  Trash2,
  X,
  Clock
} from 'lucide-react';
import { NeumorphicContainer, NeumorphicButton } from './Neumorphic';

import { UserProfile, Reminder } from '../types';

interface LayoutProps {
  darkMode: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: any;
  userProfile: UserProfile | null;
  reminders: Reminder[];
  onDismissReminder: (id: string) => void;
  onClearAllReminders: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  darkMode,
  activeTab,
  onTabChange,
  user,
  userProfile,
  reminders = [],
  onDismissReminder,
  onClearAllReminders,
  onLogout,
  children,
}) => {
  const [isBellOpen, setIsBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  
  const [lastOpenedBell, setLastOpenedBell] = useState<string>(() => {
    return localStorage.getItem('pulse_last_opened_bell') || new Date().toISOString();
  });

  const activeReminders = reminders.filter(r => !r.dismissed);
  const unreadCount = activeReminders.filter(r => r.triggerAt > lastOpenedBell).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleBell = () => {
    setIsBellOpen(!isBellOpen);
    const nowStr = new Date().toISOString();
    localStorage.setItem('pulse_last_opened_bell', nowStr);
    setLastOpenedBell(nowStr);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Plan & Focus', icon: Sparkles },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'goals_habits', label: 'Goals & Habits', icon: Target },
    { id: 'calendar', label: 'Schedule', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const unsentReminders = activeReminders.filter((r) => r.sent === false);

  // Play a soft notification tone when a new unsent reminder arrives
  useEffect(() => {
    if (unsentReminders.length > 0) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playTone = (freq: number, delay: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
          
          gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
          gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + delay + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.start(audioCtx.currentTime + delay);
          osc.stop(audioCtx.currentTime + delay + duration);
        };
        
        playTone(659.25, 0, 0.4); // E5
        playTone(880.00, 0.12, 0.6); // A5
      } catch (err) {
        console.warn("Audio Context chime not supported", err);
      }
    }
  }, [unsentReminders.length]);

  return (
    <div className={`min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row transition-colors duration-500 ${
      darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]'
    }`}>
      {/* Floating Real-Time Toasts */}
      <div className="fixed top-6 right-6 z-50 space-y-3 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        <AnimatePresence>
          {unsentReminders.map((rem) => (
            <motion.div
              key={rem.id}
              initial={{ opacity: 0, x: 50, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="pointer-events-auto"
            >
              <NeumorphicContainer
                darkMode={darkMode}
                glass={true}
                className="p-4 border-l-4 border-indigo-500 flex gap-3 items-start"
                rounded="2xl"
              >
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500 flex-shrink-0 animate-pulse">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-indigo-500 uppercase tracking-wider block mb-0.5">
                    AI Productivity Companion
                  </span>
                  <p className="text-xs text-gray-800 dark:text-gray-100 font-semibold leading-relaxed font-sans">
                    {rem.message}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button
                      id={`toast-ack-${rem.id}`}
                      onClick={() => onDismissReminder(rem.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 cursor-pointer transition-all"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              </NeumorphicContainer>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar - Desktop Layout (Visible only on md screens and larger) */}
      <aside className="hidden md:flex md:w-64 flex-shrink-0 flex-col p-6 pr-3 justify-between md:sticky md:top-0 md:h-screen z-50">
        <div className="space-y-8">
          {/* Brand Logo Header */}
          <div className="flex items-center justify-between pl-2">
            <div className="flex items-center gap-3">
              <NeumorphicContainer
                darkMode={darkMode}
                rounded="xl"
                className="w-10 h-10 flex items-center justify-center text-indigo-500"
              >
                <Zap className="w-5 h-5 animate-pulse text-indigo-500 fill-indigo-500/20" />
              </NeumorphicContainer>
              <div>
                <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">Pulse</h1>
                <span className="text-[9px] font-mono font-bold text-indigo-500 tracking-wider uppercase">AI Productivity</span>
              </div>
            </div>

            {/* Notification Bell on Desktop */}
            {user && (
              <div className="relative" ref={bellRef}>
                <NeumorphicButton
                  id="desktop-notification-bell-btn"
                  darkMode={darkMode}
                  onClick={handleToggleBell}
                  className="w-11 h-11 rounded-full flex items-center justify-center p-0 relative"
                >
                  {unreadCount > 0 ? (
                    <>
                      <BellRing className="w-6 h-6 text-indigo-500 dark:text-indigo-400 animate-bounce" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-[#1a1d24] shadow-sm animate-pulse">
                        {unreadCount}
                      </span>
                    </>
                  ) : (
                    <Bell className="w-6 h-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                  )}
                </NeumorphicButton>

                {/* Dropdown overlay */}
                <AnimatePresence>
                  {isBellOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute left-0 md:left-[-140px] mt-3 w-80 max-h-[420px] z-50 pointer-events-auto"
                    >
                      <NeumorphicContainer
                        darkMode={darkMode}
                        glass={true}
                        className="p-4 space-y-3 overflow-hidden flex flex-col max-h-[420px] border border-white/20 dark:border-white/10"
                        rounded="2xl"
                      >
                        <div className="flex items-center justify-between pb-2 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)]">
                          <h4 className="font-bold text-xs text-gray-800 dark:text-gray-100 flex items-center gap-1.5 uppercase tracking-wide font-mono">
                            <Sparkles className="w-4 h-4 text-indigo-500" /> Companion Logs
                          </h4>
                          {activeReminders.length > 0 && (
                            <button
                              onClick={onClearAllReminders}
                              className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Clear All
                            </button>
                          )}
                        </div>

                        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                          {activeReminders.length === 0 ? (
                            <div className="py-8 text-center space-y-2">
                              <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto animate-pulse" />
                              <p className="text-xs text-gray-400 font-medium">Your AI productivity companion is quiet.</p>
                            </div>
                          ) : (
                            [...activeReminders]
                              .sort((a, b) => new Date(b.triggerAt).getTime() - new Date(a.triggerAt).getTime())
                              .map((rem) => (
                                <div
                                  key={rem.id}
                                  className={`p-3 rounded-xl transition-all text-left ${
                                    rem.triggerAt > lastOpenedBell
                                      ? 'bg-indigo-500/5 dark:bg-indigo-500/10 shadow-sm'
                                      : 'bg-gray-500/5 dark:bg-gray-500/10'
                                  }`}
                                >
                                  <div className="flex justify-between items-start gap-3">
                                    <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500 flex-shrink-0 mt-0.5">
                                      <Sparkles className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                      <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed font-sans font-medium">
                                        {rem.message}
                                      </p>
                                      <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(rem.triggerAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                        <span>•</span>
                                        <span className="capitalize">{rem.type}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => onDismissReminder(rem.id)}
                                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </NeumorphicContainer>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
 
          {/* Navigation Menu Links */}
          <nav className="space-y-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <NeumorphicButton
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  darkMode={darkMode}
                  active={isActive}
                  variant={isActive ? 'secondary' : 'ghost'}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full justify-start py-3.5 px-4 text-sm transition-all duration-300 relative ${
                    isActive
                      ? 'border-l-4 border-indigo-500 rounded-l-none pl-3 text-indigo-500 dark:text-indigo-400 font-bold'
                      : ''
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </NeumorphicButton>
              );
            })}
          </nav>
        </div>
 
        {/* User Card at base of Sidebar */}
        {user && (
          <NeumorphicContainer darkMode={darkMode} className="p-4" rounded="2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {userProfile?.name?.charAt(0) || user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'P'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                  {userProfile?.name || user.displayName || 'Pulse User'}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </NeumorphicContainer>
        )}
      </aside>
 
      {/* Main Panel Frame (Takes up all remaining room) */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 md:pl-3 pb-24 md:pb-8 overflow-y-auto max-w-5xl mx-auto w-full relative">
        {/* Mobile Header (Only visible on sm/mobile) */}
        <header className="flex md:hidden items-center justify-between mb-6 p-1">
          <div className="flex items-center gap-2">
            <NeumorphicContainer
              darkMode={darkMode}
              rounded="xl"
              className="w-8 h-8 flex items-center justify-center text-indigo-500"
            >
              <Zap className="w-4 h-4 animate-pulse text-indigo-500 fill-indigo-500/20" />
            </NeumorphicContainer>
            <h1 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Pulse</h1>
          </div>
 
          {user && (
            <div className="flex items-center gap-2.5">
              {/* Notification Bell on Mobile */}
              <div className="relative" ref={bellRef}>
                <NeumorphicButton
                  id="mobile-notification-bell-btn"
                  darkMode={darkMode}
                  onClick={handleToggleBell}
                  className="w-10 h-10 rounded-full flex items-center justify-center p-0 relative"
                >
                  {unreadCount > 0 ? (
                    <>
                      <BellRing className="w-5.5 h-5.5 text-indigo-500 dark:text-indigo-400 animate-bounce" />
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border border-white dark:border-[#1a1d24] shadow-sm animate-pulse">
                        {unreadCount}
                      </span>
                    </>
                  ) : (
                    <Bell className="w-5.5 h-5.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                  )}
                </NeumorphicButton>

                {/* Dropdown overlay */}
                <AnimatePresence>
                  {isBellOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-3 w-72 max-h-[350px] z-50 pointer-events-auto"
                    >
                      <NeumorphicContainer
                        darkMode={darkMode}
                        glass={true}
                        className="p-3.5 space-y-2.5 overflow-hidden flex flex-col max-h-[350px] border border-white/20 dark:border-white/10"
                        rounded="2xl"
                      >
                        <div className="flex items-center justify-between pb-2 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)]">
                          <h4 className="font-bold text-[11px] text-gray-800 dark:text-gray-100 flex items-center gap-1.5 uppercase tracking-wide font-mono">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Companion Logs
                          </h4>
                          {activeReminders.length > 0 && (
                            <button
                              onClick={onClearAllReminders}
                              className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> Clear All
                            </button>
                          )}
                        </div>

                        <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                          {activeReminders.length === 0 ? (
                            <div className="py-6 text-center space-y-1.5">
                              <Bell className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto animate-pulse" />
                              <p className="text-[11px] text-gray-400 font-medium">Your companion is quiet.</p>
                            </div>
                          ) : (
                            [...activeReminders]
                              .sort((a, b) => new Date(b.triggerAt).getTime() - new Date(a.triggerAt).getTime())
                              .map((rem) => (
                                <div
                                  key={rem.id}
                                  className={`p-2.5 rounded-xl transition-all text-left ${
                                    rem.triggerAt > lastOpenedBell
                                      ? 'bg-indigo-500/5 dark:bg-indigo-500/10 shadow-sm'
                                      : 'bg-gray-500/5 dark:bg-gray-500/10'
                                  }`}
                                >
                                  <div className="flex justify-between items-start gap-2.5">
                                    <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-500 flex-shrink-0 mt-0.5">
                                      <Sparkles className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                      <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed font-sans font-medium">
                                        {rem.message}
                                      </p>
                                      <div className="flex items-center gap-1.5 text-[9px] text-gray-400 dark:text-gray-500 font-mono">
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{new Date(rem.triggerAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                        <span>•</span>
                                        <span className="capitalize">{rem.type}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => onDismissReminder(rem.id)}
                                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </NeumorphicContainer>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {userProfile?.name?.charAt(0) || user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'P'}
              </div>
            </div>
          )}
        </header>
 
        {/* Inner Screen Dashboard View Wrapper with smooth fade-in */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1"
        >
          {children}
        </motion.div>
      </main>
 
      {/* Mobile Sticky Bottom Navigation (Visible only on screens below md) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-transparent p-4 pt-1">
        <NeumorphicContainer
          darkMode={darkMode}
          glass={true}
          inset={false}
          className="flex justify-around items-center py-2 px-3 border border-indigo-500/10"
          rounded="2xl"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-item-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-3.5 rounded-xl transition-all duration-300 min-w-[50px] cursor-pointer focus:outline-none ${
                  isActive
                    ? 'text-indigo-500 dark:text-indigo-400 scale-105'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
                style={{ minHeight: '44px' }}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                <span className="text-[9px] font-bold mt-1 tracking-tight capitalize">{item.id.replace('_', ' ')}</span>
              </button>
            );
          })}
        </NeumorphicContainer>
      </nav>
    </div>
  );
};
