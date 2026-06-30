import { ScheduleBlock, GCalEvent } from '../types';

/**
 * Service for communicating directly with Google Calendar API on behalf of the authenticated user.
 */

export const fetchGCalEvents = async (accessToken: string, userId: string): Promise<GCalEvent[]> => {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(); // Sync past 15 days
  const timeMax = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(); // Sync next 45 days

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin
  )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Google Calendar events: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const items = data.items || [];

  return items
    .filter((item: any) => item.status !== 'cancelled' && item.start?.dateTime && item.end?.dateTime)
    .map((item: any) => ({
      id: item.id,
      userId,
      title: item.summary || 'Google Calendar Event',
      start: item.start.dateTime,
      end: item.end.dateTime,
      isBusy: item.transparency !== 'transparent',
    }));
};

export const createGCalEvent = async (
  accessToken: string,
  block: { start: string; end: string },
  taskTitle: string
): Promise<string> => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  const body = {
    summary: `⚡ Pulse Slot: ${taskTitle}`,
    description: `Auto-scheduled productivity slot synced by Pulse Companion.`,
    start: {
      dateTime: block.start,
    },
    end: {
      dateTime: block.end,
    },
    reminders: {
      useDefault: true,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Google Calendar event: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.id;
};

export const deleteGCalEvent = async (accessToken: string, eventId: string): Promise<void> => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`Failed to delete Google Calendar event: ${response.status} - ${errorText}`);
  }
};
