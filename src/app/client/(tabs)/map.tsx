import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ConsultantMap } from '@/components/maps/consultant-map';
import { Chip } from '@/components/ui/chip';
import { useData } from '@/context/data-context';
import { usePublicConsultants } from '@/hooks/use-directory';

export default function ConsultantMapScreen() {
  const { categories } = useData();
  const router = useRouter();
  const consultants = usePublicConsultants();
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const visible = categoryId ? consultants.filter((c) => c.categoryId === categoryId) : consultants;

  return (
    <View className="flex-1 bg-sand">
      <ConsultantMap
        consultants={visible}
        onSelect={(id) => router.push({ pathname: '/client/consultant/[id]', params: { id } })}
      />

      {/* Filters float over the map. */}
      <View className="absolute left-0 right-0 top-0 gap-2 pt-3" pointerEvents="box-none">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          <Chip label="All services" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
        </ScrollView>
        <View className="mx-4 self-start rounded-full bg-ink/85 px-3 py-1.5">
          <Text className="text-caption font-semibold text-on-dark">
            {visible.length === 0
              ? 'No verified consultants for this service yet'
              : `${visible.length} verified ${visible.length === 1 ? 'consultant' : 'consultants'} · tap a pin to view`}
          </Text>
        </View>
      </View>
    </View>
  );
}
