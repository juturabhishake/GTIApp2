import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen, GlassPanel } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';

const steps = [
  { title: 'Check the daily summary', description: 'On Overview, choose a date to see that day’s production quantity, rejection quantity, and combined total quantity.', icon: 'stats-chart-outline' as const },
  { title: 'Start a rejection entry', description: 'Open Rejection Entry and scan the part QR code. Review the part information returned by the lookup.', icon: 'qr-code-outline' as const },
  { title: 'Complete and submit', description: 'Fill in the applicable rejection details, including quantity and reason, then submit the entry. A confirmation or error appears on the form.', icon: 'clipboard-outline' as const },
  { title: 'Review transaction history', description: 'History opens with this month’s first day through today selected. Change either date to filter records, then tap a card to see its details.', icon: 'time-outline' as const },
  { title: 'Manage your workspace', description: 'Use Settings or the profile menu to change appearance and access your account options.', icon: 'options-outline' as const },
];

export default function GuideScreen() {
  const { colors } = useAppTheme();
  return (
    <AppScreen title="Process guide" subtitle="How to use the GTI production and rejection workspace.">
      <GlassPanel>
        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepRail}>
                <View style={[styles.stepIcon, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name={step.icon} size={19} color={colors.accent} />
                </View>
                {index < steps.length - 1 && <View style={[styles.connector, { backgroundColor: colors.border }]} />}
              </View>
              <View style={styles.stepCopy}>
                <Text style={[styles.stepNumber, { color: colors.accent }]}>STEP {index + 1}</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                <Text style={[styles.stepDescription, { color: colors.muted }]}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassPanel>
      <View style={[styles.notice, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={19} color={colors.accent} />
        <Text style={[styles.noticeText, { color: colors.muted }]}>
          Production Entry is currently an information screen; its entry form is not available yet.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 2 },
  step: { minHeight: 108, flexDirection: 'row', gap: 15 },
  stepRail: { width: 42, alignItems: 'center' },
  stepIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  connector: { width: 1, flex: 1, marginVertical: 6 },
  stepCopy: { flex: 1, paddingTop: 2, paddingBottom: 18, gap: 5 },
  stepNumber: { fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  stepTitle: { fontSize: 15, fontWeight: '700' },
  stepDescription: { fontSize: 12, lineHeight: 18 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
