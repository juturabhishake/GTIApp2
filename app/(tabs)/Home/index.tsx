import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { AppScreen, GlassPanel } from '@/components/AppScreen';
import { useAppTheme, type AppTheme } from '@/contexts/ThemeContext';

// const API_BASE_URL = 'http://10.225.51.14:3000';
const API_BASE_URL = 'https://gtiappsbackend.vercel.app';

type DashboardSummary = {
  productionQty: number;
  rejectionQty: number;
};

function formatApiDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getDashboardSummary(date: Date): Promise<DashboardSummary> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: formatApiDate(date) }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String(payload.message)
      : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !payload.data || typeof payload.data !== 'object') {
    throw new Error('The dashboard summary response did not contain summary data.');
  }
  const row = payload.data as Record<string, unknown>;
  const getValue = (key: string) => {
    const value = Number(Object.entries(row).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1]);
    if (!Number.isFinite(value)) throw new Error(`The dashboard summary returned an invalid ${key}.`);
    return value;
  };
  return {
    productionQty: getValue('productionQty'),
    rejectionQty: getValue('rejectionQty'),
  };
}

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary>({ productionQty: 0, rejectionQty: 0 });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const { colors, theme, uiMode } = useAppTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    SecureStore.getItemAsync('full_name').then((name) => {
      if (name) setFullName(name);
    }).catch((error) => console.error('Unable to load profile name:', error));
  }, []);

  useEffect(() => {
    let active = true;
    setSummaryLoading(true);
    setSummaryError('');
    getDashboardSummary(selectedDate).then((nextSummary) => {
      if (active) setSummary(nextSummary);
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : 'Unable to load the daily summary.';
      setSummaryError(message);
      console.error('Unable to load dashboard summary:', error);
    }).finally(() => {
      if (active) setSummaryLoading(false);
    });
    return () => {
      active = false;
    };
  }, [selectedDate]);

  if (uiMode === 'classic') {
    return (
      <>
        <ClassicHome
          fullName={fullName}
          summary={summary}
          selectedDate={selectedDate}
          summaryLoading={summaryLoading}
          summaryError={summaryError}
          onDatePress={() => setDatePickerVisible(true)}
        />
        <DateTimePickerModal
          isVisible={datePickerVisible}
          mode="date"
          date={selectedDate}
          maximumDate={new Date()}
          onConfirm={(date) => {
            setSelectedDate(date);
            setDatePickerVisible(false);
          }}
          onCancel={() => setDatePickerVisible(false)}
        />
      </>
    );
  }

  const palette = getDashboardPalette(theme);
  const compact = height < 740;

  return (
    <View style={[styles.modernRoot, { backgroundColor: palette.background }]}>
      <ScrollView
        style={styles.modernScroll}
        contentContainerStyle={[styles.modernContent, { paddingBottom: 16 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.blueHeader, { backgroundColor: palette.header, paddingTop: insets.top + (compact ? 30 : 36), minHeight: insets.top + (compact ? 186 : 210) }]}>
          <Text style={styles.appTitle}>Production App</Text>
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeCopy}>
              <Text style={styles.welcomeLabel}>Welcome,</Text>
              <Text style={styles.welcomeName} numberOfLines={1}>{fullName || 'Team member'}</Text>
              <Text style={styles.welcomeRole}>Operator</Text>
            </View>
            <View style={styles.avatar}>
              {fullName ? (
                <Text style={styles.avatarInitials}>{fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Text>
              ) : (
                <Image source={require('@/assets/images/gti_icon.png')} style={styles.avatarLogo} resizeMode="contain" />
              )}
            </View>
          </View>
        </View>

        <View style={[styles.dashboardPanel, { backgroundColor: palette.panel, marginTop: compact ? -27 : -34 }]}>
          <View style={styles.actionList}>
            <DashboardAction
              icon="clipboard-outline"
              title="Search Order"
              subtitle="Find production orders"
              tint="#3687cf"
              background={palette.blueTint}
              textColor={palette.text}
              mutedColor={palette.muted}
              onPress={() => router.push('/Orders')}
            />
            <DashboardAction
              icon="bar-chart-outline"
              title="Production Entry"
              subtitle="Record completed quantity"
              tint="#31a779"
              background={palette.greenTint}
              textColor={palette.text}
              mutedColor={palette.muted}
              onPress={() => router.push('/ProductionEntry')}
            />
            <DashboardAction
              icon="close-circle"
              title="Rejection Entry"
              subtitle="Record rejected quantity"
              tint="#dd5360"
              background={palette.redTint}
              textColor={palette.text}
              mutedColor={palette.muted}
              onPress={() => router.push('/RejectionEntry')}
            />
            <DashboardAction
              icon="time"
              title="Transaction History"
              subtitle="View submitted records"
              tint="#8a6ad0"
              background={palette.purpleTint}
              textColor={palette.text}
              mutedColor={palette.muted}
              onPress={() => router.push('/History')}
            />
          </View>

          <View style={[styles.summaryHeading, { borderTopColor: palette.divider }]}>
            <Text style={[styles.summaryTitle, { color: palette.text }]}>Today's Summary</Text>
            <Pressable onPress={() => setDatePickerVisible(true)} style={styles.summaryDate} accessibilityRole="button">
              <Ionicons name="calendar-outline" size={14} color={palette.muted} />
              <Text style={[styles.summaryDateText, { color: palette.muted }]}>{selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              <Ionicons name="chevron-down" size={12} color={palette.muted} />
            </Pressable>
          </View>
          <View style={styles.summaryCards}>
            <SummaryCard value={summaryLoading ? '…' : summaryError ? '—' : String(summary.productionQty)} label="Production Qty" tint="#31a779" background={palette.greenTint} textColor={palette.text} />
            <SummaryCard value={summaryLoading ? '…' : summaryError ? '—' : String(summary.rejectionQty)} label="Rejection Qty" tint="#dd5360" background={palette.redTint} textColor={palette.text} />
            <SummaryCard value={summaryLoading ? '…' : summaryError ? '—' : String(summary.productionQty + summary.rejectionQty)} label="Total Qty" tint="#3687cf" background={palette.blueTint} textColor={palette.text} />
          </View>
          {summaryError ? <Text style={[styles.summaryError, { color: palette.muted }]}>{summaryError}</Text> : null}
        </View>
      </ScrollView>
      <DateTimePickerModal
        isVisible={datePickerVisible}
        mode="date"
        date={selectedDate}
        maximumDate={new Date()}
        onConfirm={(date) => {
          setSelectedDate(date);
          setDatePickerVisible(false);
        }}
        onCancel={() => setDatePickerVisible(false)}
      />
    </View>
  );
}

function DashboardAction({ icon, title, subtitle, tint, background, textColor, mutedColor, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  tint: string;
  background: string;
  textColor: string;
  mutedColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.dashboardAction, { backgroundColor: background }, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: `${tint}20` }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.actionSubtitle, { color: mutedColor }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={mutedColor} />
    </Pressable>
  );
}

function SummaryCard({ value, label, tint, background, textColor }: {
  value: string;
  label: string;
  tint: string;
  background: string;
  textColor: string;
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: background }]}>
      <Text style={[styles.summaryValue, { color: tint }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function ClassicHome({ fullName, summary, selectedDate, summaryLoading, summaryError, onDatePress }: {
  fullName: string;
  summary: DashboardSummary;
  selectedDate: Date;
  summaryLoading: boolean;
  summaryError: string;
  onDatePress: () => void;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <AppScreen title="Welcome back" subtitle="Your operations workspace, at a glance.">
      <GlassPanel style={classicStyles.hero}>
        <View style={classicStyles.heroCopy}>
          <View style={[classicStyles.eyebrow, { backgroundColor: colors.accentSoft }]}>
            <View style={[classicStyles.statusDot, { backgroundColor: colors.accent }]} />
            <Text style={[classicStyles.eyebrowText, { color: colors.accent }]}>GTI WORKSPACE</Text>
          </View>
          <Text style={[classicStyles.greeting, { color: colors.text }]}>Hello{fullName ? `, ${fullName}` : ''}</Text>
          <Text style={[classicStyles.description, { color: colors.muted }]}>Choose a workspace tool to continue your work.</Text>
        </View>
        <View style={[classicStyles.heroIcon, { backgroundColor: colors.accentSoft }]}>
          <Image source={require('@/assets/images/gti_icon.png')} style={classicStyles.heroLogo} resizeMode="contain" />
        </View>
      </GlassPanel>
      <Text style={[classicStyles.sectionTitle, { color: colors.text }]}>Quick access</Text>
      <View style={classicStyles.actions}>
        <ClassicQuickAction icon="scan-outline" title="Part scanner" subtitle="Scan part and machine codes" onPress={() => router.push('/Scanner')} />
        <ClassicQuickAction icon="document-text-outline" title="Training form" subtitle="Record a training session" onPress={() => router.push('/trainingForm')} />
        <ClassicQuickAction icon="compass-outline" title="Process guide" subtitle="Review the workflow steps" onPress={() => router.push('/explore')} />
      </View>
      <View style={classicStyles.summaryHeading}>
        <Text style={[classicStyles.sectionTitle, styles.classicSummaryTitle, { color: colors.text }]}>Daily Summary</Text>
        <Pressable onPress={onDatePress} style={[styles.classicSummaryDate, { borderColor: colors.border, backgroundColor: colors.surfaceSolid }]} accessibilityRole="button">
          <Ionicons name="calendar-outline" size={14} color={colors.accent} />
          <Text style={[styles.classicSummaryDateText, { color: colors.text }]}>
            {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Ionicons name="chevron-down" size={12} color={colors.muted} />
        </Pressable>
      </View>
      <View style={classicStyles.summaryCards}>
        <SummaryCard value={summaryLoading ? '…' : summaryError ? '—' : String(summary.productionQty)} label="Production Qty" tint="#31a779" background={colors.accentSoft} textColor={colors.text} />
        <SummaryCard value={summaryLoading ? '…' : summaryError ? '—' : String(summary.rejectionQty)} label="Rejection Qty" tint={colors.danger} background={`${colors.danger}12`} textColor={colors.text} />
        <SummaryCard value={summaryLoading ? '…' : summaryError ? '—' : String(summary.productionQty + summary.rejectionQty)} label="Total Qty" tint="#3687cf" background="rgba(54,135,207,0.12)" textColor={colors.text} />
      </View>
      {summaryError ? <Text style={[styles.summaryError, { color: colors.muted }]}>{summaryError}</Text> : null}
    </AppScreen>
  );
}

function ClassicQuickAction({ icon, title, subtitle, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed, hovered }) => [classicStyles.actionPressable, hovered && classicStyles.actionHovered, pressed && styles.pressed]}>
      <GlassPanel style={classicStyles.actionCard}>
        <View style={[classicStyles.actionIcon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name={icon} size={21} color={colors.accent} />
        </View>
        <View style={classicStyles.actionCopy}>
          <Text style={[classicStyles.actionTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[classicStyles.actionSubtitle, { color: colors.muted }]}>{subtitle}</Text>
        </View>
        <Ionicons name="arrow-forward" size={17} color={colors.muted} />
      </GlassPanel>
    </Pressable>
  );
}

function getDashboardPalette(theme: AppTheme) {
  if (theme === 'dark') {
    return {
      background: '#10191e',
      header: '#125481',
      panel: '#1a272e',
      text: '#edf4f5',
      muted: '#a0b1b8',
      divider: 'rgba(218,235,239,0.12)',
      blueTint: 'rgba(54,135,207,0.18)',
      greenTint: 'rgba(49,167,121,0.18)',
      redTint: 'rgba(221,83,96,0.18)',
      purpleTint: 'rgba(138,106,208,0.18)',
    };
  }
  return {
    background: '#f3f5f8',
    header: '#1874b9',
    panel: '#ffffff',
    text: '#273849',
    muted: '#7b8996',
    divider: 'rgba(39,56,73,0.10)',
    blueTint: '#edf5fd',
    greenTint: '#edf8f2',
    redTint: '#fff0f1',
    purpleTint: '#f4f0fb',
  };
}

const styles = StyleSheet.create({
  modernRoot: { flex: 1 },
  modernScroll: { flex: 1 },
  modernContent: { flexGrow: 1 },
  blueHeader: { paddingHorizontal: 22, paddingBottom: 43, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  appTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 19 },
  welcomeCopy: { flex: 1 },
  welcomeLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 12 },
  welcomeName: { color: '#ffffff', fontSize: 19, fontWeight: '700', marginTop: 2 },
  welcomeRole: { color: 'rgba(255,255,255,0.78)', fontSize: 11, marginTop: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#286b9f', fontSize: 14, fontWeight: '700' },
  avatarLogo: { width: 32, height: 32 },
  dashboardPanel: { marginHorizontal: 12, paddingHorizontal: 15, paddingTop: 16, paddingBottom: 18, borderRadius: 25, shadowColor: '#162e42', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  actionList: { gap: 10 },
  dashboardAction: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18 },
  actionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: { fontSize: 12, fontWeight: '700' },
  actionSubtitle: { fontSize: 10 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  summaryHeading: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  summaryTitle: { fontSize: 12, fontWeight: '700' },
  summaryDate: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryDateText: { fontSize: 10 },
  summaryCards: { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 7, paddingHorizontal: 3 },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 9, lineHeight: 12, textAlign: 'center', marginTop: 3 },
  summaryError: { fontSize: 10, lineHeight: 15, marginTop: 8 },
  classicSummaryTitle: { marginTop: 0, marginBottom: 0 },
  classicSummaryDate: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  classicSummaryDateText: { fontSize: 10, fontWeight: '600' },
});

const classicStyles = StyleSheet.create({
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
  actionCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  actionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: { fontSize: 13, fontWeight: '700' },
  actionSubtitle: { fontSize: 11 },
  summaryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 26 },
  summaryCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
});
