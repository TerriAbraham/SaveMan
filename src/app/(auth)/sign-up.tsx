import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { categories } from '@/data/categories';
import { cities } from '@/data/users';

type AccountType = 'client' | 'consultant';
type Field = 'name' | 'email' | 'phone' | 'city' | 'title' | 'categoryId' | 'password' | 'confirm';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>('client');
  const [form, setForm] = useState<Record<Field, string>>({
    name: '',
    email: '',
    phone: '',
    city: '',
    title: '',
    categoryId: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isConsultant = accountType === 'consultant';

  function set(field: Field, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const next: Partial<Record<Field, string>> = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.phone.replace(/\D/g, '').length < 7) next.phone = 'Enter a valid phone number.';
    if (!form.city) next.city = 'Choose your town or city.';
    if (isConsultant && form.title.trim().length < 3) next.title = 'Enter your professional title.';
    if (isConsultant && !form.categoryId) next.categoryId = 'Choose your area of expertise.';
    if (form.password.length < 6) next.password = 'Use at least 6 characters.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    setFormError(null);
    if (!validate()) return;
    // On success the root layout switches to the new user's section.
    setFormError(
      signUp({
        role: accountType,
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        city: form.city,
        title: isConsultant ? form.title : undefined,
        categoryId: isConsultant ? form.categoryId : undefined,
      }),
    );
  }

  return (
    <AuthScreen title="Create account" subtitle="Join SaveMan as a client or a consultant.">
      <View style={styles.segment} accessibilityRole="tablist">
        {(['client', 'consultant'] as const).map((t) => {
          const selected = accountType === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setAccountType(t)}
              style={[styles.segmentItem, selected && styles.segmentSelected]}>
              <Icon name={t === 'client' ? 'person' : 'briefcase'} size={18} color={selected ? colors.textOnDark : colors.textMuted} />
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {t === 'client' ? 'I need advice' : "I'm a consultant"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField label="Full name" icon="person" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Grace Kaupa" autoComplete="name" error={errors.name} />
      <TextField
        label="Email"
        icon="mail"
        value={form.email}
        onChangeText={(v) => set('email', v)}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={errors.email}
      />
      <TextField label="Phone" icon="phone" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+675 7xxx xxxx" keyboardType="phone-pad" autoComplete="tel" error={errors.phone} />

      <ChipGroup label="Town or city" error={errors.city}>
        {cities.map((c) => (
          <Chip key={c} label={c} selected={form.city === c} onPress={() => set('city', c)} />
        ))}
      </ChipGroup>

      {isConsultant && (
        <>
          <TextField label="Professional title" icon="briefcase" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Chartered Accountant" error={errors.title} />
          <ChipGroup label="Area of expertise" error={errors.categoryId}>
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} selected={form.categoryId === c.id} onPress={() => set('categoryId', c.id)} />
            ))}
          </ChipGroup>
        </>
      )}

      <TextField label="Password" icon="lock" value={form.password} onChangeText={(v) => set('password', v)} placeholder="At least 6 characters" secureTextEntry autoComplete="new-password" error={errors.password} />
      <TextField label="Confirm password" icon="lock" value={form.confirm} onChangeText={(v) => set('confirm', v)} placeholder="Re-enter password" secureTextEntry autoComplete="new-password" error={errors.confirm} />

      {isConsultant && (
        <View style={styles.notice}>
          <Icon name="verified" size={20} color={colors.forest} />
          <Text style={styles.noticeText}>
            New consultant profiles are reviewed by the SaveMan team. Clients can book you once you are verified.
          </Text>
        </View>
      )}

      {formError && <Text style={styles.formError}>{formError}</Text>}

      <Button title={isConsultant ? 'Apply as consultant' : 'Create account'} onPress={handleSubmit} />

      <View style={styles.switchRow}>
        <Text style={styles.muted}>Already have an account?</Text>
        <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
          <Text style={styles.link}>Log in</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

function ChipGroup({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  segmentSelected: { backgroundColor: colors.ink },
  segmentText: { ...type.label, fontSize: 14, color: colors.textMuted },
  segmentTextSelected: { color: colors.textOnDark },
  group: { gap: spacing.sm },
  groupLabel: { ...type.label, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fieldError: { ...type.caption, color: colors.redDark },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.forestTint,
  },
  noticeText: { ...type.body, color: colors.text, flex: 1 },
  formError: {
    ...type.label,
    color: colors.redDark,
    backgroundColor: colors.redTint,
    padding: spacing.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  muted: { ...type.body, color: colors.textMuted },
  link: { ...type.body, color: colors.red, fontWeight: '700' },
});
