import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/authStore';

const STATUS_COLORS: Record<string, string> = {
  todo: '#6b7280',
  in_progress: '#6366f1',
  review: '#f59e0b',
  done: '#10b981',
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[s.statCard, { borderLeftColor: color }]}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics-portfolio'],
    queryFn: () => api.get('/analytics/portfolio').then((r) => r.data),
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.greeting}>Hi, {user?.name?.split(' ')[0]} 👋</Text>
        <Text style={s.subgreeting}>Here's your project overview</Text>

        {isLoading ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Summary stats */}
            <View style={s.statsRow}>
              <StatCard label="Projects" value={analytics?.summary?.total_projects ?? 0} color="#6366f1" />
              <StatCard label="Tasks" value={analytics?.summary?.total_tasks ?? 0} color="#06b6d4" />
              <StatCard label="Done" value={analytics?.summary?.completed_tasks ?? 0} color="#10b981" />
              <StatCard label="Overdue" value={analytics?.summary?.overdue_tasks ?? 0} color="#ef4444" />
            </View>

            {/* Active projects */}
            <Text style={s.sectionTitle}>Active Projects</Text>
            {(analytics?.projects ?? []).slice(0, 8).map((p: any) => (
              <TouchableOpacity
                key={p.id}
                style={s.projectCard}
                onPress={() => router.push({ pathname: '/projects/[id]/tasks', params: { id: p.id } })}
              >
                <View style={[s.projectDot, { backgroundColor: p.color || '#6366f1' }]} />
                <View style={s.projectInfo}>
                  <Text style={s.projectName}>{p.name}</Text>
                  <Text style={s.projectMeta}>
                    {p.done_tasks}/{p.total_tasks} tasks · {p.member_count} member{p.member_count !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={s.progressWrapper}>
                  <View style={s.progressBar}>
                    <View style={[
                      s.progressFill,
                      { width: `${p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0}%` as any },
                    ]} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subgreeting: { fontSize: 14, color: '#6b7280', marginTop: 2, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 70, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  projectCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  projectDot: { width: 10, height: 10, borderRadius: 5 },
  projectInfo: { flex: 1 },
  projectName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  projectMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  progressWrapper: { width: 60 },
  progressBar: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 2 },
});
