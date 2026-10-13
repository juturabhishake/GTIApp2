import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen, GlassPanel } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function OrdersScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen title="Orders" subtitle="Find and review production orders.">
      <GlassPanel style={styles.card}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="receipt-outline" size={25} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>No orders found</Text>
        <Text style={[styles.description, { color: colors.muted }]}>Available production orders will appear here.</Text>
      </GlassPanel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  description: { maxWidth: 280, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
