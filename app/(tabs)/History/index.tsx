import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useFocusEffect } from 'expo-router';
import { AppScreen, GlassPanel } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';

type DateField = 'start' | 'end';
type RejectionRecord = Record<string, unknown>;

const API_BASE_URL = 'https://gtiappsbackend.vercel.app';
// const API_BASE_URL = 'http://10.225.51.14:3000';

function formatApiDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getRejectionHistory(startDate: Date, endDate: Date): Promise<RejectionRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/rejection/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: formatApiDate(startDate), endDate: formatApiDate(endDate) }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String(payload.message)
      : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    throw new Error('The history response did not contain a data list.');
  }
  return payload.data.filter((row): row is RejectionRecord => !!row && typeof row === 'object' && !Array.isArray(row));
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFieldName(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFieldValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return String(value);
}

function findRecordValue(record: RejectionRecord, candidates: string[]) {
  const normalized = new Map(Object.entries(record).map(([key, value]) => [key.replace(/[^a-z0-9]/gi, '').toLowerCase(), value]));
  for (const candidate of candidates) {
    const value = normalized.get(candidate.replace(/[^a-z0-9]/gi, '').toLowerCase());
    if (value != null && String(value).trim()) return value;
  }
  return undefined;
}

function getRecordTitle(record: RejectionRecord) {
  const value = findRecordValue(record, ['partNo', 'partNumber', 'castPartNo']);
  return value == null ? 'Rejection entry' : String(value);
}

function getRecordQuantity(record: RejectionRecord) {
  const value = findRecordValue(record, ['qty', 'quantity', 'rejectedQty']);
  return value == null ? '—' : String(value);
}

export default function HistoryScreen() {
  const { colors, uiMode } = useAppTheme();
  const { width } = useWindowDimensions();
  const today = new Date();
  const [startDate, setStartDate] = useState(() => startOfMonth(today));
  const [endDate, setEndDate] = useState(today);
  const [activeDate, setActiveDate] = useState<DateField | null>(null);
  const [records, setRecords] = useState<RejectionRecord[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    getRejectionHistory(startDate, endDate).then((data) => {
      if (active) setRecords(data);
    }).catch((loadError) => {
      if (!active) return;
      const message = loadError instanceof Error ? loadError.message : 'Unable to load rejection history.';
      setError(message);
      setRecords([]);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [startDate, endDate, refresh]));

  const chooseDate = (date: Date) => {
    if (activeDate === 'start') {
      setStartDate(date);
      if (date > endDate) setEndDate(date);
    } else {
      setEndDate(date);
      if (date < startDate) setStartDate(date);
    }
    setActiveDate(null);
  };

  const compact = width < 380;

  return (
    <AppScreen title="Transaction History" subtitle="Review rejection entries submitted during the selected dates.">
      <View style={styles.filters}>
        <DateRangeButton
          label="From"
          date={startDate}
          icon="calendar-outline"
          compact={compact}
          onPress={() => setActiveDate('start')}
        />
        <Ionicons name="arrow-forward" size={16} color={colors.muted} />
        <DateRangeButton
          label="To"
          date={endDate}
          icon="calendar-outline"
          compact={compact}
          onPress={() => setActiveDate('end')}
        />
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={[styles.activeTab, { backgroundColor: colors.accent }]}>
          <Text style={styles.activeTabText}>All</Text>
        </View>
        <View style={[styles.inactiveTab, { borderColor: colors.border }]}>
          <Text style={[styles.inactiveTabText, { color: colors.muted }]}>Rejection</Text>
        </View>
        <Text style={[styles.resultCount, { color: colors.muted }]}>{records.length} {records.length === 1 ? 'entry' : 'entries'}</Text>
      </View>

      {loading ? (
        <GlassPanel style={styles.stateCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.stateText, { color: colors.muted }]}>Loading history…</Text>
        </GlassPanel>
      ) : error ? (
        <GlassPanel style={styles.stateCard}>
          <View style={[styles.stateIcon, { backgroundColor: `${colors.danger}18` }]}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>Couldn’t load history</Text>
          <Text style={[styles.stateText, { color: colors.muted }]}>{error}</Text>
          <Pressable onPress={() => setRefresh((value) => value + 1)} style={[styles.retryButton, { backgroundColor: colors.accent }]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </GlassPanel>
      ) : records.length === 0 ? (
        <GlassPanel style={styles.stateCard}>
          <View style={[styles.stateIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="time-outline" size={25} color={colors.accent} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>No rejection entries</Text>
          <Text style={[styles.stateText, { color: colors.muted }]}>There are no submitted records between {formatDate(startDate)} and {formatDate(endDate)}.</Text>
        </GlassPanel>
      ) : (
        <View style={styles.recordList}>
          {records.map((record, index) => {
            const key = String(findRecordValue(record, ['id', 'rejectionId']) ?? index);
            return (
              <HistoryCard
                key={key}
                record={record}
                index={index}
                expanded={expandedKey === key}
                modern={uiMode === 'modern'}
                onPress={() => setExpandedKey((current) => current === key ? null : key)}
              />
            );
          })}
        </View>
      )}
      <DateTimePickerModal
        isVisible={!!activeDate}
        mode="date"
        date={activeDate === 'start' ? startDate : endDate}
        maximumDate={new Date()}
        onConfirm={chooseDate}
        onCancel={() => setActiveDate(null)}
      />
    </AppScreen>
  );
}

function DateRangeButton({ label, date, icon, compact, onPress }: {
  label: string;
  date: Date;
  icon: keyof typeof Ionicons.glyphMap;
  compact: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.dateButton, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
      <Ionicons name={icon} size={17} color={colors.accent} />
      <View style={styles.dateCopy}>
        <Text style={[styles.dateLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[styles.dateValue, { color: colors.text }]} numberOfLines={1}>
          {date.toLocaleDateString(undefined, compact
            ? { month: 'short', day: 'numeric' }
            : { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={15} color={colors.muted} />
    </Pressable>
  );
}

function HistoryCard({ record, index, expanded, modern, onPress }: {
  record: RejectionRecord;
  index: number;
  expanded: boolean;
  modern: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const data = Object.entries(record);
  const createdAt = findRecordValue(record, ['created_at', 'createdAt']);
  const detailRows = data.filter(([key]) => !['__v', 'productdetailsxml'].includes(key.replace(/[^a-z0-9]/gi, '').toLowerCase()));
  return (
    <GlassPanel style={modern ? { ...styles.recordCard, ...styles.modernCard } : styles.recordCard}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={styles.cardTop}>
          <View style={[styles.directionIcon, { backgroundColor: `${colors.danger}16` }]}>
            <Ionicons name="arrow-down" size={19} color={colors.danger} />
          </View>
          <View style={styles.recordHeading}>
            <Text style={[styles.recordTitle, { color: colors.text }]} numberOfLines={1}>{getRecordTitle(record)}</Text>
            <Text style={[styles.recordSubtitle, { color: colors.muted }]} numberOfLines={1}>
              {String(findRecordValue(record, ['op', 'operation', 'machineNumber']) ?? 'Rejection details')}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.danger}16` }]}>
            <Text style={[styles.badgeText, { color: colors.danger }]}>Rejection</Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.quantityText, { color: colors.text }]}>Qty: {getRecordQuantity(record)}</Text>
          <Text style={[styles.createdAtText, { color: colors.muted }]} numberOfLines={1}>{formatFieldValue(createdAt)}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.muted} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={[styles.detailGrid, { borderTopColor: colors.border }]}>
          {detailRows.map(([key, value]) => (
            <View key={`${index}-${key}`} style={[styles.detailItem, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.detailLabel, { color: colors.muted }]}>{formatFieldName(key)}</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatFieldValue(value)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  dateButton: { flex: 1, minWidth: 0, minHeight: 58, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  dateCopy: { flex: 1, minWidth: 0 },
  dateLabel: { fontSize: 10, marginBottom: 3 },
  dateValue: { fontSize: 11, fontWeight: '700' },
  tabs: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, padding: 4, marginBottom: 14 },
  activeTab: { minWidth: 68, minHeight: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  activeTabText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  inactiveTab: { minHeight: 34, borderRightWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  inactiveTabText: { fontSize: 11, fontWeight: '600' },
  resultCount: { fontSize: 10, marginLeft: 'auto', marginRight: 8 },
  stateCard: { minHeight: 210, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  stateIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  stateTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stateText: { maxWidth: 310, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 4 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recordList: { gap: 12 },
  recordCard: { padding: 15, borderRadius: 18 },
  modernCard: { borderRadius: 20 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  directionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  recordHeading: { flex: 1, minWidth: 0, gap: 4 },
  recordTitle: { fontSize: 13, fontWeight: '700' },
  recordSubtitle: { fontSize: 10 },
  badge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11, paddingLeft: 49 },
  quantityText: { fontSize: 11, fontWeight: '700' },
  createdAtText: { flex: 1, fontSize: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13, paddingTop: 12 },
  detailItem: { flexGrow: 1, flexBasis: '45%', minWidth: 125, borderRadius: 11, padding: 9 },
  detailLabel: { fontSize: 9, fontWeight: '600', marginBottom: 4 },
  detailValue: { fontSize: 11, lineHeight: 16 },
});
