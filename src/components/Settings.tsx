import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';
import { NeumorphicContainer, NeumorphicButton, NeumorphicInput, NeumorphicSelect, NeumorphicToggle } from './Neumorphic';
import { 
  Settings as SettingsIcon, 
  Clock, 
  Globe, 
  Bell, 
  Moon, 
  Sun, 
  LogOut, 
  Check, 
  User,
  Sliders,
  Shield,
  HelpCircle
} from 'lucide-react';

interface SettingsProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  userProfile: UserProfile | null;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  darkMode,
  onToggleDarkMode,
  userProfile,
  onUpdateProfile,
  onLogout,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [timezone, setTimezone] = useState('UTC');
  
  // Notification states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Quiet hours states
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');

  // Load from userProfile prop
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setEmail(userProfile.email || '');
      setStartTime(userProfile.workingHours?.start || '09:00');
      setEndTime(userProfile.workingHours?.end || '17:00');
      setTimezone(userProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setQuietHoursEnabled(userProfile.quietHours?.enabled || false);
      setQuietHoursStart(userProfile.quietHours?.start || '22:00');
      setQuietHoursEnd(userProfile.quietHours?.end || '08:00');
    }
  }, [userProfile]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: name.trim(),
      workingHours: {
        start: startTime,
        end: endTime,
      },
      timezone,
      quietHours: {
        enabled: quietHoursEnabled,
        start: quietHoursStart,
        end: quietHoursEnd,
      }
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Asia/Kolkata',
    'Australia/Sydney',
  ];

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          System Settings
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Tailor focus hours, timezone preferences, and custom theme layouts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Theme toggle + Profile overview */}
        <div className="space-y-6">
          {/* Profile Quick-card */}
          <NeumorphicContainer darkMode={darkMode} className="p-6 text-center space-y-4" rounded="3xl">
            <div className="flex justify-center">
              <NeumorphicContainer darkMode={darkMode} inset={true} rounded="full" className="w-20 h-20 flex items-center justify-center text-indigo-500 text-3xl font-extrabold uppercase shadow-inner">
                {name?.charAt(0) || email?.charAt(0).toUpperCase() || 'P'}
              </NeumorphicContainer>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-gray-800 dark:text-white truncate">{name || 'Pulse Explorer'}</h3>
              <p className="text-xs text-gray-400 truncate">{email || 'No email associated'}</p>
            </div>

            <div className="pt-2">
              <NeumorphicButton
                id="settings-logout-btn"
                darkMode={darkMode}
                variant="danger"
                onClick={onLogout}
                className="w-full text-xs py-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </NeumorphicButton>
            </div>
          </NeumorphicContainer>

          {/* Theme card */}
          <NeumorphicContainer darkMode={darkMode} className="p-6 space-y-4" rounded="3xl">
            <h4 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-wider">Visual Preference</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {darkMode ? 'Dark Mode Surface' : 'Light Mode Surface'}
              </span>
              <NeumorphicButton
                id="toggle-theme-btn"
                darkMode={darkMode}
                onClick={onToggleDarkMode}
                className="w-12 h-12 rounded-full flex items-center justify-center p-0"
              >
                {darkMode ? (
                  <Moon className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Sun className="w-5 h-5 text-amber-500" />
                )}
              </NeumorphicButton>
            </div>
          </NeumorphicContainer>
        </div>

        {/* Right column: Working Hours and preferences Form */}
        <div className="md:col-span-2 space-y-6">
          <NeumorphicContainer darkMode={darkMode} className="p-6 md:p-8" rounded="3xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              Configure Work Profile
            </h3>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                  Display Name
                </label>
                <NeumorphicInput
                  id="settings-profile-name"
                  darkMode={darkMode}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dhruv"
                  required
                />
              </div>

              {/* Working hours sliders/inputs */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Working Hours Slot
                </label>
                <p className="text-xs text-gray-400 leading-normal">
                  Pulse schedules AI task blocks inside your core working hours to protect your personal downtime.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400">Day Begins</span>
                    <NeumorphicInput
                      id="settings-start-time"
                      darkMode={darkMode}
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400">Day Concludes</span>
                    <NeumorphicInput
                      id="settings-end-time"
                      darkMode={darkMode}
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Timezone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" /> Regional Timezone
                </label>
                <NeumorphicSelect
                  id="settings-timezone-select"
                  darkMode={darkMode}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-sm"
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </NeumorphicSelect>
              </div>

              {/* Toggle Alerts */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5 text-indigo-500" /> Companion Notifications
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-sm text-gray-800 dark:text-gray-200 block font-medium">Auto-Milestones Audio Notifications</span>
                      <span className="text-xs text-gray-400">Triggers custom synth chime warning when tasks are approaching deadline.</span>
                    </div>
                    <NeumorphicToggle
                      id="toggle-email-alerts"
                      checked={emailNotifications}
                      onChange={setEmailNotifications}
                      darkMode={darkMode}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-sm text-gray-800 dark:text-gray-200 block font-medium">Send Overdue Status Reports</span>
                      <span className="text-xs text-gray-400">Triggers status check emails on habits in danger of broken streak.</span>
                    </div>
                    <NeumorphicToggle
                      id="toggle-push-alerts"
                      checked={pushNotifications}
                      onChange={setPushNotifications}
                      darkMode={darkMode}
                    />
                  </div>
                </div>
              </div>

              {/* Quiet Hours Selection */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800/40">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" /> Quiet Hours (DND)
                    </label>
                    <p className="text-xs text-gray-400 leading-normal mt-1">
                      Silence companion reminders and suppress visual notification toasts during designated rest periods.
                    </p>
                  </div>
                  <NeumorphicToggle
                    id="toggle-quiet-hours"
                    checked={quietHoursEnabled}
                    onChange={setQuietHoursEnabled}
                    darkMode={darkMode}
                  />
                </div>

                {quietHoursEnabled && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 gap-4 bg-gray-500/5 dark:bg-gray-500/10 p-4 rounded-2xl border border-gray-500/5 dark:border-gray-500/10"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide font-mono">DND Begins</span>
                      <NeumorphicInput
                        id="settings-quiet-start"
                        darkMode={darkMode}
                        type="time"
                        value={quietHoursStart}
                        onChange={(e) => setQuietHoursStart(e.target.value)}
                        required={quietHoursEnabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide font-mono">DND Concludes</span>
                      <NeumorphicInput
                        id="settings-quiet-end"
                        darkMode={darkMode}
                        type="time"
                        value={quietHoursEnd}
                        onChange={(e) => setQuietHoursEnd(e.target.value)}
                        required={quietHoursEnabled}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Save Trigger */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800/40 flex items-center justify-between gap-4">
                <span className="text-xs text-green-500 font-bold flex items-center gap-1">
                  {saveSuccess && (
                    <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1">
                      <Check className="w-4 h-4" /> Workspace updated live!
                    </motion.span>
                  )}
                </span>
                <NeumorphicButton
                  id="settings-save-profile-btn"
                  darkMode={darkMode}
                  variant="primary"
                  type="submit"
                  className="py-2.5 px-6 text-xs"
                >
                  Save Workspace Profile
                </NeumorphicButton>
              </div>
            </form>
          </NeumorphicContainer>
        </div>
      </div>
    </div>
  );
};
