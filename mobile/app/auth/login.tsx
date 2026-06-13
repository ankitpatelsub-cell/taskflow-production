import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/login', { email, password }).then((r) => r.data),
    onSuccess: async (data) => {
      await login(data.accessToken, data.user);
      router.replace('/(tabs)/dashboard');
    },
    onError: (err: any) => {
      Alert.alert('Login failed', err.response?.data?.error || 'Check your credentials and try again.');
    },
  });

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <View style={s.logo}><Text style={s.logoText}>✓</Text></View>
        <Text style={s.title}>TaskFlow</Text>
        <Text style={s.subtitle}>Sign in to your account</Text>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => mutation.mutate()}
        />

        <TouchableOpacity
          style={[s.button, mutation.isPending && s.buttonDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending || !email || !password}
        >
          {mutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.buttonText}>Sign in</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 15, color: '#111827', backgroundColor: '#f9fafb' },
  button: { backgroundColor: '#6366f1', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
