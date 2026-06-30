import { Task, ScheduleBlock, Reminder, UserProfile } from '../types';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Checks if the user is currently in their designated quiet hours.
 */
export function isCurrentlyInQuietHours(userProfile: UserProfile | null): boolean {
  if (!userProfile?.quietHours?.enabled || !userProfile.quietHours.start || !userProfile.quietHours.end) {
    return false;
  }
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTimeInMins = currentHour * 60 + currentMin;

    const [startH, startM] = userProfile.quietHours.start.split(':').map(Number);
    const [endH, endM] = userProfile.quietHours.end.split(':').map(Number);

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
      return false;
    }

    const startInMins = startH * 60 + startM;
    const endInMins = endH * 60 + endM;

    if (startInMins <= endInMins) {
      return currentTimeInMins >= startInMins && currentTimeInMins <= endInMins;
    } else {
      // Quiet hours cross midnight (e.g. 22:00 to 08:00)
      return currentTimeInMins >= startInMins || currentTimeInMins <= endInMins;
    }
  } catch (e) {
    console.error("Error evaluating quiet hours", e);
    return false;
  }
}

/**
 * Runs the context-aware reminder engine logic and saves any newly triggered reminders.
 */
export async function runReminderEngine(
  user: any,
  tasks: Task[],
  scheduleBlocks: ScheduleBlock[],
  existingReminders: Reminder[],
  userProfile: UserProfile | null,
  isLocalMode: boolean,
  onLocalRemindersUpdated?: (updated: Reminder[]) => void
): Promise<void> {
  if (!user) return;

  const now = new Date();
  const inQuietHours = isCurrentlyInQuietHours(userProfile);
  const newReminders: Reminder[] = [];

  for (const task of tasks) {
    // Skip finished tasks or those with invalid deadlines
    if (task.status === 'done' || !task.deadline) continue;

    const deadlineDate = new Date(task.deadline);
    if (isNaN(deadlineDate.getTime())) continue;

    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffMins = diffMs / (1000 * 60);
    const diffHours = diffMs / (1000 * 60 * 60);

    // If deadline has already passed, skip
    if (diffMs <= 0) continue;

    // Check if task is scheduled in the near future (next 12 hours)
    const isScheduledInNearFuture = scheduleBlocks.some((block) => {
      if (block.taskId !== task.id) return false;
      const blockStart = new Date(block.start);
      if (isNaN(blockStart.getTime())) return false;
      const hoursToBlockStart = (blockStart.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursToBlockStart >= 0 && hoursToBlockStart <= 12;
    });

    // 1. High Priority / High Effort task early warning:
    // Criteria: Priority >= 70 or Effort >= 60 minutes.
    // Trigger window: within 12 hours of deadline.
    const isHighPriorityOrEffort = (task.priorityScore && task.priorityScore >= 70) || task.estimatedMinutes >= 60;
    const earlyReminderId = `reminder_${task.id}_early`;
    const earlyExists = existingReminders.some((r) => r.id === earlyReminderId);

    if (isHighPriorityOrEffort && diffHours <= 12 && !earlyExists) {
      if (isScheduledInNearFuture) {
        // Delayed/silenced due to scheduled focused block in the near future!
        console.log(`Silencing early warning for high priority/effort task '${task.title}' because it is already scheduled soon.`);
      } else {
        // Create reminder. If quiet hours are active, set sent = true so it is added to history silently.
        const reminder: Reminder = {
          id: earlyReminderId,
          userId: user.uid,
          taskId: task.id,
          triggerAt: now.toISOString(),
          message: `High priority/effort task '${task.title}' is due in ${Math.round(diffHours)} hours. Best to get started soon!`,
          type: 'deadline',
          sent: inQuietHours // Set sent to true if in quiet hours to silence the pop-up/toast
        };
        newReminders.push(reminder);
      }
    }

    // 2. "Last call" warning:
    // Criteria: Task status is 'todo' and deadline is within 2x estimatedMinutes.
    const lastCallReminderId = `reminder_${task.id}_lastcall`;
    const lastCallExists = existingReminders.some((r) => r.id === lastCallReminderId);
    const doubleEffortMins = 2 * (task.estimatedMinutes || 30); // fallback to 30 mins if not specified

    if (task.status === 'todo' && diffMins <= doubleEffortMins && !lastCallExists) {
      if (isScheduledInNearFuture) {
        // Delayed/silenced due to scheduled focused block!
        console.log(`Silencing last-call for task '${task.title}' because it has a scheduled focused block.`);
      } else {
        const reminder: Reminder = {
          id: lastCallReminderId,
          userId: user.uid,
          taskId: task.id,
          triggerAt: now.toISOString(),
          message: `Last call! '${task.title}' takes about ${task.estimatedMinutes || 30} mins to complete but the deadline is in ${Math.round(diffMins)} mins!`,
          type: 'deadline',
          sent: inQuietHours // Set sent to true if in quiet hours to silence the pop-up/toast
        };
        newReminders.push(reminder);
      }
    }
  }

  // Save new reminders
  if (newReminders.length > 0) {
    if (isLocalMode) {
      const updated = [...existingReminders, ...newReminders];
      localStorage.setItem(`pulse_reminders_${user.uid}`, JSON.stringify(updated));
      if (onLocalRemindersUpdated) {
        onLocalRemindersUpdated(updated);
      }
    } else {
      for (const rem of newReminders) {
        try {
          const docRef = doc(db, 'reminders', rem.id);
          await setDoc(docRef, rem);
        } catch (err) {
          console.error("Failed to save reminder in Firestore", err);
        }
      }
    }
  }
}
