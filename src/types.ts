export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  workingHours: {
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  timezone: string;
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  dailyInsight?: string;
  dailyInsightSignature?: string;
  tasksPrioritizationSignature?: string;
  lastPrioritizedAt?: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  deadline: string; // ISO String or YYYY-MM-DD
  estimatedMinutes: number;
  category: string;
  status: 'todo' | 'in_progress' | 'done';
  priorityScore: number; // 1 to 100
  priorityReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Milestone {
  title: string;
  dueDate: string;
  done: boolean;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetDate: string;
  milestones: Milestone[];
  progressPercent: number;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  lastCompletedAt?: string; // ISO String of last completion date
  completedDates?: string[]; // Array of YYYY-MM-DD strings when completed
}

export interface Reminder {
  id: string;
  userId: string;
  taskId: string;
  triggerAt: string; // ISO String
  message: string;
  type: 'deadline' | 'schedule' | 'general';
  sent: boolean;
  dismissed?: boolean;
}

export interface ScheduleBlock {
  id: string;
  userId: string;
  taskId: string;
  start: string; // ISO String
  end: string;   // ISO String
  gcalEventId?: string | null; // Optional Google Calendar Event ID
}

export interface GCalEvent {
  id: string;
  userId: string;
  title: string;
  start: string; // ISO String
  end: string;   // ISO String
  isBusy: boolean;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
}

export interface Recommendation {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'focus_time' | 'procrastination' | 'habit_risk' | 'general';
  type: 'info' | 'warning' | 'success';
  createdAt: string; // ISO String
  dismissed: boolean;
}
