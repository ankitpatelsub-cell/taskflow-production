import { FlatList, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import api from '../../../src/lib/api';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done',
};
const STATUS_COLORS: Record<string, string> = {
  todo: '#6b7280', in_progress: '#6366f1', review: '#f59e0b', done: '#10b981',
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981',
};

export default function ProjectTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState('');

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: taskData, isLoading } = useQuery({
    queryKey: ['tasks', id, status],
    queryFn: () => api.get(`/projects/${id}/tasks`, { params: status ? { status } : {} }).then((r) => r.data),
    enabled: !!id,
  });

  const tasks = taskData?.tasks ?? [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.titleRow}>
          <View style={[s.dot, { backgroundColor: project?.color || '#6366f1' }]} />
          <Text style={s.title} numberOfLines={1}>{project?.name || 'Project'}</Text>
        </View>
        <View style={s.filterRow}>
          {['', 'todo', 'in_progress', 'review', 'done'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[s.chip, status === f && s.chipActive]}
              onPress={() => setStatus(f)}
            >
              <Text style={[s.chipText, status === f && s.chipTextActive]}>
                {STATUS_LABELS[f] || 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          renderItem={({ item: t }) => (
            <View style={s.card}>
              <View style={[s.statusBar, { backgroundColor: STATUS_COLORS[t.status] || '#6b7280' }]} />
              <View style={s.body}>
                <Text style={s.taskTitle} numberOfLines={2}>{t.title}</Text>
                <View style={s.metaRow}>
                  <Text style={s.statusLabel}>{STATUS_LABELS[t.status] || t.status}</Text>
                  {t.priority && (
                    <View style={[s.priorityBadge, { backgroundColor: PRIORITY_COLORS[t.priority] + '20' }]}>
                      <Text style={[s.priorityText, { color: PRIORITY_COLORS[t.priority] }]}>{t.priority}</Text>
                    </View>
                  )}
                  {t.assignee_name && <Text style={s.assignee}>{t.assignee_name}</Text>}
                </View>
                {t.deadline && (
                  <Text style={s.deadline}>Due {new Date(t.deadline).toLocaleDateString()}</Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No tasks{status ? ` with status "${STATUS_LABELS[status]}"` : ''}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: 16 },
  back: { marginBottom: 8 },
  backText: { fontSize: 16, color: '#6366f1', fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  chipTextActive: { color: '#fff' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statusBar: { width: 4 },
  body: { flex: 1, padding: 14 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  statusLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  assignee: { fontSize: 11, color: '#9ca3af' },
  deadline: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 14 },
});
