import { FlatList, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/authStore';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const STATUS_COLORS: Record<string, string> = {
  todo: '#6b7280',
  in_progress: '#6366f1',
  review: '#f59e0b',
  done: '#10b981',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

const FILTERS = ['all', 'todo', 'in_progress', 'review', 'done'];

export default function MyTasksScreen() {
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState('all');

  const { data = [], isLoading } = useQuery({
    queryKey: ['my-tasks', user?.id],
    queryFn: () => api.get(`/users/${user?.id}/tasks`).then((r) => r.data),
    enabled: !!user?.id,
  });

  const filtered = filter === 'all' ? data : data.filter((t: any) => t.status === filter);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>My Tasks</Text>
        <View style={s.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[s.filterChip, filter === f && s.filterActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>
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
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          renderItem={({ item: t }) => (
            <View style={s.card}>
              <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[t.status] || '#6b7280' }]} />
              <View style={s.info}>
                <Text style={s.taskTitle} numberOfLines={2}>{t.title}</Text>
                <View style={s.metaRow}>
                  {t.priority && (
                    <View style={[s.priorityBadge, { backgroundColor: PRIORITY_COLORS[t.priority] + '20' }]}>
                      <Text style={[s.priorityText, { color: PRIORITY_COLORS[t.priority] }]}>
                        {t.priority}
                      </Text>
                    </View>
                  )}
                  {t.deadline && (
                    <Text style={s.deadline}>
                      Due {new Date(t.deadline).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>
                {filter === 'all' ? 'No tasks assigned to you' : `No ${STATUS_LABELS[filter]} tasks`}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 20, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  filterActive: { backgroundColor: '#6366f1' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  filterTextActive: { color: '#fff' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  info: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  deadline: { fontSize: 12, color: '#9ca3af' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 14 },
});
