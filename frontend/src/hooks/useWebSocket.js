import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001/ws`;

let socket = null;
let reconnectTimer = null;
let listeners = new Map(); // eventType -> Set<callback>

function getSocket(token) {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;

  if (socket) {
    socket.close();
    socket = null;
  }

  socket = new WebSocket(`${WS_URL}?token=${token}`);

  socket.onopen = () => {
    console.log('[WS] Connected');
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      const cbs = listeners.get(msg.type);
      if (cbs) cbs.forEach((cb) => cb(msg.payload));
      // Also fire wildcard listeners
      const all = listeners.get('*');
      if (all) all.forEach((cb) => cb(msg));
    } catch {}
  };

  socket.onclose = (e) => {
    if (e.code === 4001) return; // Unauthorized — don't reconnect
    reconnectTimer = setTimeout(() => {
      const token = useAuthStore.getState().accessToken;
      if (token) getSocket(token);
    }, 3000);
  };

  socket.onerror = () => {};

  return socket;
}

export function connectWebSocket(token) {
  if (token) getSocket(token);
}

export function disconnectWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (socket) { socket.close(); socket = null; }
}

export function subscribeProject(projectId) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'subscribe', projectId }));
  }
}

export function unsubscribeProject(projectId) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'unsubscribe', projectId }));
  }
}

export function useWsEvent(eventType, callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const handler = (payload) => cbRef.current(payload);
    if (!listeners.has(eventType)) listeners.set(eventType, new Set());
    listeners.get(eventType).add(handler);
    return () => listeners.get(eventType)?.delete(handler);
  }, [eventType]);
}
