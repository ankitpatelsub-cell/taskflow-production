import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.JWT_SECRET = 'test_jwt_secret_32chars_long_key';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

vi.mock('../config/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

vi.mock('../config/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

const { broadcast, broadcastToUser } = await import('../services/wsService.js');
const { signAccess } = await import('../utils/jwt.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WS_OPEN = 1;
const WS_CLOSED = 3;

function makeMockWs(state = WS_OPEN) {
  return {
    readyState: state,
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    on: vi.fn(),
    ping: vi.fn(),
    isAlive: true,
    _projects: new Set(),
  };
}

// ─── broadcast() ─────────────────────────────────────────────────────────────
describe('broadcast()', () => {
  it('does nothing when no room exists for the projectId', () => {
    // Should not throw
    expect(() => broadcast('nonexistent-project', { type: 'test' })).not.toThrow();
  });

  it('sends a JSON-serialised payload to open sockets in the room', async () => {
    const { register } = await import('../services/wsService.js');

    // Build a fake WebSocket server + connected client via register()
    const token = signAccess({ id: 'ws-user-1', email: 'u@t.com', role: 'member', name: 'U' });
    const fakeWs = makeMockWs();
    const messageHandlers = {};
    fakeWs.on = vi.fn((event, fn) => { messageHandlers[event] = fn; });

    const fakeWss = { on: vi.fn(), clients: new Set([fakeWs]) };
    fakeWss.on.mockImplementation((event, fn) => {
      if (event === 'connection') {
        fn(fakeWs, { url: `/ws?token=${token}`, socket: { remoteAddress: '127.0.0.1' } });
      }
    });

    register(fakeWss);

    // Subscribe the socket to a project
    const projectId = 'proj-broadcast-1';
    messageHandlers['message'](JSON.stringify({ type: 'subscribe', projectId }));

    const event = { type: 'task:created', payload: { id: 'task-x' } };
    broadcast(projectId, event);

    expect(fakeWs.send).toHaveBeenCalledWith(JSON.stringify(event));
  });

  it('skips closed sockets in the room', async () => {
    const { register } = await import('../services/wsService.js');

    const token = signAccess({ id: 'ws-user-2', email: 'u2@t.com', role: 'member', name: 'U2' });
    const closedWs = makeMockWs(WS_CLOSED);
    const messageHandlers = {};
    closedWs.on = vi.fn((event, fn) => { messageHandlers[event] = fn; });

    const fakeWss = { on: vi.fn(), clients: new Set([closedWs]) };
    fakeWss.on.mockImplementation((event, fn) => {
      if (event === 'connection') {
        fn(closedWs, { url: `/ws?token=${token}`, socket: { remoteAddress: '127.0.0.1' } });
      }
    });

    register(fakeWss);
    const projectId = 'proj-broadcast-2';
    messageHandlers['message'](JSON.stringify({ type: 'subscribe', projectId }));

    broadcast(projectId, { type: 'test' });

    expect(closedWs.send).not.toHaveBeenCalled();
  });
});

// ─── broadcastToUser() ────────────────────────────────────────────────────────
describe('broadcastToUser()', () => {
  it('does nothing when userId has no registered sockets', () => {
    expect(() => broadcastToUser('unknown-user', { type: 'test' })).not.toThrow();
  });

  it('sends JSON payload to an open socket registered for the user', async () => {
    const { register } = await import('../services/wsService.js');

    const userId = 'ws-user-3';
    const token = signAccess({ id: userId, email: 'u3@t.com', role: 'member', name: 'U3' });
    const fakeWs = makeMockWs();
    fakeWs.on = vi.fn();

    const fakeWss = { on: vi.fn(), clients: new Set([fakeWs]) };
    fakeWss.on.mockImplementation((event, fn) => {
      if (event === 'connection') {
        fn(fakeWs, { url: `/ws?token=${token}`, socket: { remoteAddress: '127.0.0.1' } });
      }
    });

    register(fakeWss);

    const event = { type: 'notification:new', payload: { id: 'n-1' } };
    broadcastToUser(userId, event);

    expect(fakeWs.send).toHaveBeenCalledWith(JSON.stringify(event));
  });

  it('skips closed sockets for the target user', async () => {
    const { register } = await import('../services/wsService.js');

    const userId = 'ws-user-4';
    const token = signAccess({ id: userId, email: 'u4@t.com', role: 'member', name: 'U4' });
    const closedWs = makeMockWs(WS_CLOSED);
    closedWs.on = vi.fn();

    const fakeWss = { on: vi.fn(), clients: new Set([closedWs]) };
    fakeWss.on.mockImplementation((event, fn) => {
      if (event === 'connection') {
        fn(closedWs, { url: `/ws?token=${token}`, socket: { remoteAddress: '127.0.0.1' } });
      }
    });

    register(fakeWss);
    broadcastToUser(userId, { type: 'test' });
    expect(closedWs.send).not.toHaveBeenCalled();
  });
});

// ─── register() — auth failure ─────────────────────────────────────────────────
describe('register() — WebSocket authentication', () => {
  it('closes connection with 4001 when token is missing', async () => {
    const { register } = await import('../services/wsService.js');

    const fakeWs = makeMockWs();
    fakeWs.on = vi.fn();

    const fakeWss = { on: vi.fn(), clients: new Set() };
    fakeWss.on.mockImplementation((event, fn) => {
      if (event === 'connection') {
        fn(fakeWs, { url: '/ws', socket: { remoteAddress: '127.0.0.1' } });
      }
    });

    register(fakeWss);
    expect(fakeWs.close).toHaveBeenCalledWith(4001, 'Unauthorized');
  });

  it('closes connection with 4001 when token is invalid', async () => {
    const { register } = await import('../services/wsService.js');

    const fakeWs = makeMockWs();
    fakeWs.on = vi.fn();

    const fakeWss = { on: vi.fn(), clients: new Set() };
    fakeWss.on.mockImplementation((event, fn) => {
      if (event === 'connection') {
        fn(fakeWs, { url: '/ws?token=bad.jwt.token', socket: { remoteAddress: '127.0.0.1' } });
      }
    });

    register(fakeWss);
    expect(fakeWs.close).toHaveBeenCalledWith(4001, 'Unauthorized');
  });
});

// ─── register() — subscribe / unsubscribe messages ────────────────────────────
describe('register() — subscribe and unsubscribe', () => {
  async function buildConnectedWs(userId = 'sub-user-1') {
    const { register } = await import('../services/wsService.js');
    const token = signAccess({ id: userId, email: `${userId}@t.com`, role: 'member', name: userId });
    const fakeWs = makeMockWs();
    const messageHandlers = {};
    fakeWs.on = vi.fn((event, fn) => { messageHandlers[event] = fn; });

    const fakeWss = { on: vi.fn(), clients: new Set([fakeWs]) };
    fakeWss.on.mockImplementation((event, fn) => {
      if (event === 'connection') {
        fn(fakeWs, { url: `/ws?token=${token}`, socket: { remoteAddress: '127.0.0.1' } });
      }
    });

    register(fakeWss);
    return { fakeWs, messageHandlers };
  }

  it('adds the socket to the project room on subscribe', async () => {
    const { fakeWs, messageHandlers } = await buildConnectedWs('sub-user-a');
    const projectId = 'proj-sub-1';
    messageHandlers['message'](JSON.stringify({ type: 'subscribe', projectId }));
    expect(fakeWs._projects.has(projectId)).toBe(true);
  });

  it('removes the socket from the project room on unsubscribe', async () => {
    const { fakeWs, messageHandlers } = await buildConnectedWs('sub-user-b');
    const projectId = 'proj-unsub-1';
    messageHandlers['message'](JSON.stringify({ type: 'subscribe', projectId }));
    messageHandlers['message'](JSON.stringify({ type: 'unsubscribe', projectId }));
    expect(fakeWs._projects.has(projectId)).toBe(false);
  });

  it('ignores malformed JSON messages without throwing', async () => {
    const { messageHandlers } = await buildConnectedWs('sub-user-c');
    expect(() => messageHandlers['message']('not json')).not.toThrow();
  });
});
