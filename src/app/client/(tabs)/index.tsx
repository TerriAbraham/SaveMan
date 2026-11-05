import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { ConsultantCard } from '@/components/consultant-card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import { cities } from '@/data/users';
import { usePublicConsultants } from '@/hooks/use-directory';
import { filterConsultants } from '@/utils/search';

export default function FindConsultantsScreen() {
  const { categories } = useData();
  const router = useRouter();
  const { user } = useAuth();
  const consultants = usePublicConsultants();

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);

  const results = filterConsultants(consultants, categories, { query, categoryId, city });
  const hasFilters = query.trim() !== '' || categoryId !== null || city !== null;

  function clearFilters() {
    setQuery('');
    setCategoryId(null);
    setCity(null);
  }

  return (
    <View className="flex-1 bg-sand">
      {/* Search and filters stay fixed while results scroll. */}
      <View className="gap-3 border-b border-line bg-surface pb-3 pt-4">
        <View className="px-4">
          <Text className="mb-3 text-title text-fg">Hi {user?.name.split(' ')[0]}, who can help you today?</Text>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Name, service or location"
            label="Search consultants"
          />
        </View>

        <FilterRow label="Service">
          <Chip label="All" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
        </FilterRow>

        <FilterRow label="Location">
          <Chip label="All PNG" selected={city === null} onPress={() => setCity(null)} />
          {cities.map((c) => (
            <Chip key={c} label={c} selected={city === c} onPress={() => setCity(city === c ? null : c)} />
          ))}
        </FilterRow>
      </View>

      <FlatList
        data={results}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-3 p-4 pb-8"
        ListHeaderComponent={
          <View className="flex-row items-center justify-between">
            <Text className="text-label text-fg-muted">
              {results.length} verified {results.length === 1 ? 'consultant' : 'consultants'}
            </Text>
            {hasFilters && (
              <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button">
                <Text className="text-label text-red">Clear filters</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="search"
            title="No consultants found"
            message="Try a different word, or choose another service or location."
            actionLabel={hasFilters ? 'Clear filters' : undefined}
            onAction={clearFilters}
          />
        }
        renderItem={({ item }) => (
          <ConsultantCard
            consultant={item}
            categoryName={categories.find((c) => c.id === item.categoryId)?.name ?? ''}
            onPress={() => router.push({ pathname: '/client/consultant/[id]', params: { id: item.id } })}
          />
        )}
      />
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="px-4 text-caption font-semibold uppercase tracking-[1px] text-fg-muted">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-2 px-4">
        {children}
      </ScrollView>
    </View>
  );
}
