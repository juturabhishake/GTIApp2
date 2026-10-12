import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen, GlassPanel } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';

const steps = [
  { title: 'Scan the part', description: 'Use the scanner to capture the part code.', icon: 'qr-code-outline' as const },
  { title: 'Scan the machine', description: 'Scan the machine code associated with the part.', icon: 'hardware-chip-outline' as const },
  { title: 'Save or reject', description: 'Save a valid pairing, or choose a rejection reason and confirm.', icon: 'checkmark-done-outline' as const },
];

export default function GuideScreen() {
  const { colors } = useAppTheme();
  return (
    <AppScreen title="Process guide" subtitle="A quick overview of the part and machine workflow.">
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
});
