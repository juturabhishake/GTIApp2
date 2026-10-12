import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { AppScreen, GlassPanel } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const { colors } = useAppTheme();
  const router = useRouter();

  useEffect(() => {
    SecureStore.getItemAsync('full_name').then((name) => {
      if (name) setFullName(name);
    });
  }, []);

  return (
    <AppScreen title="Welcome back" subtitle="Your operations workspace, at a glance.">
      <GlassPanel style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={[styles.eyebrow, { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.eyebrowText, { color: colors.accent }]}>GTI WORKSPACE</Text>
          </View>
          <Text style={[styles.greeting, { color: colors.text }]}>Hello{fullName ? `, ${fullName}` : ''}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Choose a workspace tool to continue your work.
          </Text>
        </View>
        <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
          <Image source={require('@/assets/images/gti_icon.png')} style={styles.heroLogo} resizeMode="contain" />
        </View>
      </GlassPanel>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick access</Text>
      <View style={styles.actions}>
        <QuickAction icon="scan-outline" title="Part scanner" subtitle="Scan part and machine codes" onPress={() => router.push('/Scanner')} />
        <QuickAction icon="document-text-outline" title="Training form" subtitle="Record a training session" onPress={() => router.push('/trainingForm')} />
        <QuickAction icon="compass-outline" title="Process guide" subtitle="Review the workflow steps" onPress={() => router.push('/explore')} />
      </View>
    </AppScreen>
  );
}

function QuickAction({ icon, title, subtitle, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed, hovered }) => [styles.actionPressable, hovered && styles.actionHovered, pressed && styles.actionPressed]}>
      <GlassPanel style={styles.actionCard}>
        <View style={[styles.actionIcon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name={icon} size={21} color={colors.accent} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.actionSubtitle, { color: colors.muted }]}>{subtitle}</Text>
        </View>
        <Ionicons name="arrow-forward" size={17} color={colors.muted} />
      </GlassPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 185, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, overflow: 'hidden' },
  heroCopy: { flex: 1, gap: 13 },
  eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  greeting: { fontSize: 27, lineHeight: 34, fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 20 },
  heroIcon: { width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  heroLogo: { width: 54, height: 54 },
  sectionTitle: { marginTop: 28, marginBottom: 14, fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionPressable: { flexGrow: 1, flexBasis: 260 },
  actionHovered: { transform: [{ translateY: -2 }] },
  actionPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  actionCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  actionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: { fontSize: 13, fontWeight: '700' },
  actionSubtitle: { fontSize: 11 },
});
