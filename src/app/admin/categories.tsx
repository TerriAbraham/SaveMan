import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SmallButton } from '@/components/ui/small-button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Category } from '@/data/types';

/** Admin: create, rename and delete the service categories clients filter by. */
export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { users } = useAuth();
  const { categories, saveCategory, deleteCategory } = useData();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usage = (id: string) => users.filter((u) => u.role === 'consultant' && u.categoryId === id).length;

  function startEdit(c: Category) {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setDescription('');
    setError(null);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    const result = await saveCategory({ name, description }, editingId);
    setBusy(false);
    if (result) {
      setError(result);
      return;
    }
    resetForm();
  }

  function confirmDelete(c: Category) {
    Alert.alert(`Delete “${c.name}”?`, 'Clients will no longer be able to filter by it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteCategory(c.id);
          if (result) Alert.alert('Can’t delete category', result);
          else if (editingId === c.id) resetForm();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader title="Categories" subtitle="Service areas clients can filter by" fallbackHref="/admin" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-4 rounded-card border border-line/70 bg-surface shadow-card p-4">
          <Text className="text-heading text-fg">{editingId ? 'Edit category' : 'Add a category'}</Text>
          <TextField
            label="Name"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(null);
            }}
            placeholder="e.g. Engineering"
            maxLength={30}
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Civil, mining and building advice"
            maxLength={80}
          />
          {error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>}
          <Button title={editingId ? 'Save changes' : 'Add category'} onPress={save} loading={busy} />
          {editingId && <Button title="Cancel editing" variant="ghost" onPress={resetForm} />}
        </View>

        <Text className="text-heading text-fg">All categories ({categories.length})</Text>
        {categories.length === 0 ? (
          <EmptyState icon="list" title="No categories yet" message="Add one above so consultants can choose their area." />
        ) : (
          categories.map((c) => {
            const count = usage(c.id);
            return (
              <View
                key={c.id}
                className={`gap-2 rounded-card border bg-surface p-4 ${editingId === c.id ? 'border-red' : 'border-line'}`}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-bold text-fg">{c.name}</Text>
                    {c.description !== '' && <Text className="text-body text-fg-muted">{c.description}</Text>}
                  </View>
                  <Text className="text-caption text-fg-muted">
                    {count} consultant{count === 1 ? '' : 's'}
                  </Text>
                </View>
                <View className="flex-row justify-end gap-2">
                  <SmallButton label="Edit" variant="outline" onPress={() => startEdit(c)} />
                  <SmallButton label="Delete" variant="danger" onPress={() => confirmDelete(c)} />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
