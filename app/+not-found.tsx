import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function NotFoundScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="compass-outline" size={30} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>This screen doesn't exist.</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>The page may have moved or the address may be incorrect.</Text>
        <Pressable onPress={() => router.replace('/')} style={[styles.button, { backgroundColor: colors.accent }]}>
          <Text style={styles.buttonText}>Back to sign in</Text>
          <Ionicons name="arrow-forward" size={17} color="#ffffff" />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { width: 62, height: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 21, fontWeight: '700', textAlign: 'center' },
  subtitle: { maxWidth: 320, marginTop: 9, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 19, borderRadius: 14, marginTop: 24 },
  buttonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
