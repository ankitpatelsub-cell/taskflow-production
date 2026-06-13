import { FlatList, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import api from '../../src/lib/api';

export default function ProjectsScreen() {
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  });

  const filtered = projects.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Projects</Text>
        <TextInput
          style={s.search}
          placeholder="Search…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={s.list}
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push({ pathname: '/projects/[id]/tasks', params: { id: p.id } })}
            >
              <View style={[s.colorBar, { backgroundColor: p.color || '#6366f1' }]} />
              <View style={s.info}>
                <Text style={s.name}>{p.name}</Text>
                {p.description ? <Text style={s.desc} numberOfLines={1}>{p.description}</Text> : null}
                <Text style={s.meta}>
                  {p.status === 'active' ? '● Active' : p.status} · {p.member_count ?? 0} members
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No projects found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 20, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  search: { backgroundColor: '#f3f4f6', borderRadius: 10, padding: 10, fontSize: 14, color: '#111827' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  colorBar: { width: 4 },
  info: { flex: 1, padding: 14 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  desc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 14 },
});
