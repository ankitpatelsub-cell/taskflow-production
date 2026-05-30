import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';

export function useLogin() {
  const { login } = useAuthStore();
  return useMutation({
    mutationFn: (creds) => api.post('/auth/login', creds).then((r) => r.data),
    onSuccess: (data) => {
      login(data.accessToken, data.user);
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      logout();
      queryClient.clear();
    },
  });
}
