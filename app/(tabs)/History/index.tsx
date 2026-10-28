import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { ExportExcelButton } from '@/components/ExportExcelButton';
import { RejectionEntryView, type ScannedPart } from '@/components/RejectionEntryView';
import { useAppTheme } from '@/contexts/ThemeContext';

type DateField = 'start' | 'end';
type RejectionRecord = Record<string, unknown>;

const API_BASE_URL = 'https://gtiappsbackend.vercel.app';

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

function getPartFromRecord(record: RejectionRecord): ScannedPart | null {
  const rawPartNo = findRecordValue(record, ['partNo', 'partNumber', 'castPartNo']);
  const rawSerialNo = findRecordValue(record, ['serialNo', 'serialNumber']);
  const rawTransId = findRecordValue(record, ['transId', 'transactionId']);
  const rawProductId = findRecordValue(record, ['productId', 'product_id', 'productid']);

  let partNo = rawPartNo ? String(rawPartNo).trim() : '';
  let serialNo = rawSerialNo ? String(rawSerialNo).trim() : '';
  let transId = rawTransId ? String(rawTransId).trim() : '';
  const productId = rawProductId ? String(rawProductId).trim() : undefined;

  if (transId && (!partNo || !serialNo)) {
    let separator = transId.lastIndexOf('|');
    if (separator <= 0 || separator === transId.length - 1) {
      separator = transId.lastIndexOf('_');
    }
    if (separator > 0 && separator < transId.length - 1) {
      if (!partNo) partNo = transId.slice(0, separator).trim();
      if (!serialNo) serialNo = transId.slice(separator + 1).trim();
    }
  }

  if (!transId && partNo && serialNo) {
    transId = `${partNo}|${serialNo}`;
  }

  if (!partNo || !serialNo) return null;

  return {
    transId,
    partNo,
    serialNo,
    productId,
  };
}

export default function HistoryScreen() {
  const { colors, uiMode } = useAppTheme();
  const { width } = useWindowDimensions();
  const today = new Date();
  const [startDate, setStartDate] = useState(() => startOfMonth(today));
  const [endDate, setEndDate] = useState(today);
  const [activeDate, setActiveDate] = useState<DateField | null>(null);
  const [records, setRecords] = useState<RejectionRecord[]>([]);
  const [selectedPart, setSelectedPart] = useState<ScannedPart | null>(null);
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

  const handleCardPress = (record: RejectionRecord) => {
    const part = getPartFromRecord(record);
    if (part) {
      setSelectedPart(part);
    }
  };

  const compact = width < 380;

  return (
    <AppScreen
      title="Transaction History"
      subtitle="Review rejection entries submitted during the selected dates."
      stickyHeader={
        <>
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
              <Text style={styles.activeTabText}>All Rejections</Text>
            </View>
            <View style={styles.tabsRight}>
              {records.length > 0 ? (
                <ExportExcelButton records={records} startDate={startDate} endDate={endDate} />
              ) : null}
              <Text style={[styles.resultCount, { color: colors.muted }]}>{records.length} total {records.length === 1 ? 'entry' : 'entries'}</Text>
            </View>
          </View>
        </>
      }
    >
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
            const key = String(findRecordValue(record, ['id', 'rejectionId', 'transId', 'rejectionEntryId']) ?? index);
            return (
              <HistoryCard
                key={key}
                record={record}
                index={index}
                modern={uiMode === 'modern'}
                onPress={() => handleCardPress(record)}
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

      <Modal
        visible={!!selectedPart}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelectedPart(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {selectedPart ? (
            <RejectionEntryView
              initialPart={selectedPart}
              hideScanner
              onClose={() => {
                setSelectedPart(null);
                setRefresh((value) => value + 1);
              }}
              onSaved={() => {
                setRefresh((value) => value + 1);
              }}
            />
          ) : null}
        </View>
      </Modal>
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

function HistoryCard({ record, index, modern, onPress }: {
  record: RejectionRecord;
  index: number;
  modern: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const createdAt = findRecordValue(record, ['created_at', 'createdAt']);
  return (
    <GlassPanel style={modern ? { ...styles.recordCard, ...styles.modernCard } : styles.recordCard}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Edit rejection form for ${getRecordTitle(record)}`}>
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
          <View style={[styles.editPill, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="create-outline" size={12} color={colors.accent} />
            <Text style={[styles.editPillText, { color: colors.accent }]}>Edit</Text>
          </View>
        </View>
      </Pressable>
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
  activeTab: { minHeight: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  activeTabText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabsRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto', marginRight: 8 },
  resultCount: { fontSize: 10 },
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
  editPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  editPillText: { fontSize: 10, fontWeight: '700' },
});
