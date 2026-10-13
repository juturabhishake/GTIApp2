import React from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/contexts/ThemeContext';

type AppScreenProps = React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  contentStyle?: ViewStyle;
  showHeading?: boolean;
}>;

export function AppScreen({ title, subtitle, contentStyle, showHeading = true, children }: AppScreenProps) {
  const { colors, uiMode } = useAppTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, uiMode === 'modern' && styles.modernContent, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        {showHeading && (
          <View style={styles.pageHeading}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {!!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
          </View>
        )}
        {children}
      </View>
    </ScrollView>
  );
}

export function GlassPanel({ children, style }: React.PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 36 },
  modernContent: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16 },
  inner: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  pageHeading: { marginBottom: 20, gap: 6 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, lineHeight: 19 },
  panel: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 2,
  },
});
