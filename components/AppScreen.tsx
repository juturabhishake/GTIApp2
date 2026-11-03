import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/ThemeContext';

type AppScreenProps = React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  contentStyle?: ViewStyle;
  showHeading?: boolean;
  stickyHeader?: React.ReactNode;
  scrollRef?: React.RefObject<React.ElementRef<typeof ScrollView> | null>;
  keyboardAvoiding?: boolean;
}>;

export function AppScreen({
  title,
  subtitle,
  contentStyle,
  showHeading = true,
  stickyHeader,
  scrollRef,
  keyboardAvoiding = true,
  children,
}: AppScreenProps) {
  const { colors, uiMode } = useAppTheme();
  const insets = useSafeAreaInsets();

  if (uiMode === 'modern') {
    const hasHeader = showHeading || !!stickyHeader;
    const body = (
      <View style={[styles.modernContainer, { backgroundColor: colors.background }]}>
        {hasHeader ? (
          <View style={[styles.modernStickyHeader, { backgroundColor: colors.background, paddingTop: insets.top + 11.5 }]}>
            <View style={styles.inner}>
              {showHeading && (
                <View style={[styles.pageHeading, styles.modernHeading]}>
                  <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                  {!!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
                </View>
              )}
              {stickyHeader}
            </View>
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={[
            styles.content,
            styles.modernContent,
            !hasHeader && { paddingTop: insets.top + 11.5 },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={styles.inner}>
            {children}
          </View>
        </ScrollView>
      </View>
    );

    if (keyboardAvoiding) {
      return (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      );
    }
    return body;
  }

  const legacyBody = (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={true}
    >
      <View style={styles.inner}>
        {showHeading && (
          <View style={styles.pageHeading}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {!!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
          </View>
        )}
        {stickyHeader}
        {children}
      </View>
    </ScrollView>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {legacyBody}
      </KeyboardAvoidingView>
    );
  }

  return legacyBody;
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
  modernContainer: { flex: 1 },
  modernStickyHeader: { paddingHorizontal: 16, paddingBottom: 6 },
  modernHeading: { marginBottom: 12 },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 6.5, paddingBottom: 36 },
  modernContent: { paddingHorizontal: 16, paddingTop: 7.5, paddingBottom: 24 },
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
