import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function ProductionEntryScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen title="Production Entry" subtitle="Record completed production quantity.">
      <View style={[styles.emptyState, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="bar-chart-outline" size={26} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Production entry</Text>
        <Text style={[styles.description, { color: colors.muted }]}>This screen is ready for the production entry form.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  emptyState: { minHeight: 230, alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 1, borderRadius: 22 },
  icon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 19, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 7 },
  description: { maxWidth: 270, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
