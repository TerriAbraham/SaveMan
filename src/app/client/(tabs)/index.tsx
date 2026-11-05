import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ConsultantCard } from '@/components/consultant-card';
import { Icon } from '@/components/icon';
import { Chip } from '@/components/ui/chip';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { categories } from '@/data/categories';
import { cities } from '@/data/users';
import { usePublicConsultants } from '@/hooks/use-directory';
import { filterConsultants } from '@/utils/search';

export default function FindConsultantsScreen() {
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
          <View className="min-h-[48px] flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-sand px-4">
            <Icon name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Name, service or location"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search consultants"
              className="flex-1 py-2.5 text-[16px] text-fg"
            />
            {query !== '' && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <Icon name="close" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
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
          <View className="items-center gap-2 rounded-card border border-line bg-surface p-6">
            <Icon name="search" size={28} color={colors.textMuted} />
            <Text className="text-heading text-fg">No consultants found</Text>
            <Text className="text-center text-body text-fg-muted">
              Try a different word, or choose another service or location.
            </Text>
          </View>
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
