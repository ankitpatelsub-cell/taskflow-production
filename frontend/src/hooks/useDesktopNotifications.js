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
  const notifications = notifData?.notifications ?? [];
  const seenIds = useRef(new Set(
    notifications.map(n => n.id)
  ));

  useEffect(() => {
    if (!getDesktopNotifEnabled()) return;

    notifications.forEach((n) => {
      if (n.is_read) return;
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);

      // Only fire for notifications that arrived in the last 2 minutes
      const age = Date.now() - new Date(n.created_at).getTime();
      if (age > TWO_MINUTES) return;

      try {
        const notif = new Notification('TaskFlow', {
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
  }, [notifications]);
}
