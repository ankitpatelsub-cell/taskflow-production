import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({ accessToken: null, user: null, isAuthenticated: false });
  });

  it('initial state is unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('login() sets user, token and isAuthenticated', () => {
    const mockUser = { id: '1', name: 'Alice', email: 'alice@test.com', role: 'user' };
    useAuthStore.getState().login('test-token-123', mockUser);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('test-token-123');
  });

  it('logout() clears all auth state', () => {
    useAuthStore.getState().login('token', { id: '1', name: 'Bob', role: 'admin' });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('setToken() updates only the access token', () => {
    useAuthStore.getState().login('old-token', { id: '1', name: 'Carol', role: 'user' });
    useAuthStore.getState().setToken('new-token');
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new-token');
    expect(state.user.name).toBe('Carol'); // user unchanged
  });

  it('updateUser() merges user fields without full reset', () => {
    useAuthStore.getState().login('token', { id: '1', name: 'Dave', role: 'user', avatar_url: null });
    useAuthStore.getState().updateUser({ name: 'David', avatar_url: '/avatar.jpg' });
    const { user } = useAuthStore.getState();
    expect(user.name).toBe('David');
    expect(user.avatar_url).toBe('/avatar.jpg');
    expect(user.role).toBe('user'); // unchanged field preserved
  });

  it('updateUser() is a no-op when user is null', () => {
    useAuthStore.getState().updateUser({ name: 'Ghost' });
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      sidebarOpen: false,
      activeProjectId: null,
      taskDrawerOpen: false,
      selectedTaskId: null,
    });
  });

  it('initial state has mobile nav closed, drawer closed', () => {
    const state = useUiStore.getState();
    expect(state.sidebarOpen).toBe(false);
    expect(state.taskDrawerOpen).toBe(false);
    expect(state.selectedTaskId).toBeNull();
    expect(state.activeProjectId).toBeNull();
  });

  it('toggleSidebar() flips sidebarOpen (mobile nav drawer)', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('setActiveProject() sets the active project id', () => {
    useUiStore.getState().setActiveProject('proj-123');
    expect(useUiStore.getState().activeProjectId).toBe('proj-123');
  });

  it('openTaskDrawer() opens drawer and sets selectedTaskId', () => {
    useUiStore.getState().openTaskDrawer('task-456');
    const state = useUiStore.getState();
    expect(state.taskDrawerOpen).toBe(true);
    expect(state.selectedTaskId).toBe('task-456');
  });

  it('closeTaskDrawer() closes drawer and clears selectedTaskId', () => {
    useUiStore.getState().openTaskDrawer('task-789');
    useUiStore.getState().closeTaskDrawer();
    const state = useUiStore.getState();
    expect(state.taskDrawerOpen).toBe(false);
    expect(state.selectedTaskId).toBeNull();
  });
});
