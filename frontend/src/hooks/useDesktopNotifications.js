import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';

const PREF_KEY = 'taskflow_desktop_notifs';
const TWO_MINUTES = 2 * 60 * 1000;

export function getDesktopNotifEnabled() {
  return (
    'Notification' in window &&
    Notification.permission === 'granted' &&
    localStorage.getItem(PREF_KEY) === 'true'
  );
}

export async function requestDesktopNotifPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') {
    localStorage.setItem(PREF_KEY, 'true');
    return 'granted';
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') localStorage.setItem(PREF_KEY, 'true');
  return result;
}

export function disableDesktopNotifs() {
  localStorage.removeItem(PREF_KEY);
}

export function useDesktopNotifications() {
  const { data: notifData } = useNotifications();
  // Stable ref to the notifications array — avoids creating a new [] on every render
  // when notifData is undefined, which would cause the effect to re-run spuriously.
  const notificationsRef = useRef([]);
  const notifications = notifData?.notifications ?? notificationsRef.current;
  if (notifData?.notifications) notificationsRef.current = notifData.notifications;

  const seenIds = useRef(new Set());
  // Tracks whether we have processed the first non-empty fetch.
  // We seed seenIds on first load (including when the list starts empty and later
  // gets items) to avoid firing OS alerts for pre-existing notifications.
  const seeded = useRef(false);

  useEffect(() => {
    if (!seeded.current) {
      // Seed on first fetch regardless of whether the list is empty or not.
      // An empty list on first fetch means we haven't seen any notifications yet —
      // we still mark as seeded so the NEXT poll with real items fires normally.
      notifications.forEach((n) => seenIds.current.add(n.id));
      // Only mark seeded once we've received a response (notifData is defined),
      // not when we're still on the initial [] fallback before the query resolves.
      if (notifData !== undefined) seeded.current = true;
      return;
    }

    if (!getDesktopNotifEnabled()) return;

    notifications.forEach((n) => {
      if (n.is_read) return;
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);

      // Only fire for notifications that arrived in the last 2 minutes
      const age = Date.now() - new Date(n.created_at).getTime();
      if (age > TWO_MINUTES) return;

      try {
        const notif = new Notification('Stride', {
          body: n.message || 'You have a new notification',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: n.id,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch {
        // Notifications blocked or unsupported — silently ignore
      }
    });
  }, [notifications, notifData]);
}
