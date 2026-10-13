import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen, GlassPanel } from '@/components/AppScreen';
import { useAppTheme, type ThemePreference, type UiMode } from '@/contexts/ThemeContext';

const themeOptions: { value: ThemePreference; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', title: 'System default', detail: 'Follow your device appearance', icon: 'phone-portrait-outline' },
  { value: 'light', title: 'Light mode', detail: 'A bright, clean workspace', icon: 'sunny-outline' },
  { value: 'dark', title: 'Dark mode', detail: 'A comfortable low-light workspace', icon: 'moon-outline' },
];

const uiOptions: { value: UiMode; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'classic', title: 'Classic UI', detail: 'Keep the familiar sidebar workspace', icon: 'albums-outline' },
  { value: 'modern', title: 'Modern UI', detail: 'Use the clean modern workspace layout', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const { colors, preference, setPreference, uiMode, setUiMode } = useAppTheme();
  return (
    <AppScreen title="Settings" subtitle="Personalize the way your workspace looks.">
      <GlassPanel>
        <View style={styles.sectionHeading}>
          <View style={[styles.headingIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="contrast-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Themes</Text>
            <Text style={[styles.sectionDescription, { color: colors.muted }]}>Choose the colors used across your workspace.</Text>
          </View>
        </View>
        <View style={styles.options}>
          {themeOptions.map((option) => {
            const selected = preference === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setPreference(option.value).catch((error) => console.error('Unable to save theme preference:', error));
                }}
                style={({ pressed, hovered }) => [
                  styles.option,
                  { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.surfaceSolid },
                  pressed && styles.optionPressed,
                  hovered && { borderColor: colors.accent },
                ]}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name={option.icon} size={19} color={selected ? colors.accent : colors.muted} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                  <Text style={[styles.optionDetail, { color: colors.muted }]}>{option.detail}</Text>
                </View>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.accent : colors.muted} />
              </Pressable>
            );
          })}
        </View>
      </GlassPanel>
      <GlassPanel style={styles.uiPanel}>
        <View style={styles.sectionHeading}>
          <View style={[styles.headingIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Interface style</Text>
            <Text style={[styles.sectionDescription, { color: colors.muted }]}>Switch between the classic and modern workspace.</Text>
          </View>
        </View>
        <View style={styles.options}>
          {uiOptions.map((option) => {
            const selected = uiMode === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setUiMode(option.value).catch((error) => console.error('Unable to save interface preference:', error));
                }}
                style={({ pressed, hovered }) => [
                  styles.option,
                  { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.surfaceSolid },
                  pressed && styles.optionPressed,
                  hovered && { borderColor: colors.accent },
                ]}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name={option.icon} size={19} color={selected ? colors.accent : colors.muted} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                  <Text style={[styles.optionDetail, { color: colors.muted }]}>{option.detail}</Text>
                </View>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.accent : colors.muted} />
              </Pressable>
            );
          })}
        </View>
      </GlassPanel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 20 },
  headingIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionDescription: { fontSize: 12 },
  options: { gap: 10 },
  uiPanel: { marginTop: 16 },
  option: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 16, borderWidth: 1 },
  optionPressed: { opacity: 0.8, transform: [{ scale: 0.995 }] },
  optionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { fontSize: 13, fontWeight: '700' },
  optionDetail: { fontSize: 11 },
});
