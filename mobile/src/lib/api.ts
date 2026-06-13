import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Set to your backend URL — override with env var in production
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({ baseURL: API_BASE, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('accessToken');
    }
    return Promise.reject(err);
  }
);

export default api;
