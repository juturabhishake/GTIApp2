import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as SecureStore from 'expo-secure-store';
import { AppScreen } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';

const OPTIONS_API_URL = 'https://gtims-quality-control.vercel.app/api/casting-rejection/get-options';
const BACKEND_BASE_URL = 'https://gtiappsbackend.vercel.app';
const PART_DETAILS_API_URL = `${BACKEND_BASE_URL}/api/product-matrix/part-details`;
const REJECTION_SUBMIT_API_URL = `${BACKEND_BASE_URL}/api/rejection/save`;

type SelectOption = { value: string; label: string };
type FormKey =
  | 'scrapDate' | 'rejectedOn' | 'foundAt' | 'leakCode' | 'shift' | 'shopFloor'
  | 'partName' | 'bhChThIm' | 'op' | 'fixPos' | 'defectType' | 'dimension'
  | 'actual' | 'qty' | 'operator' | 'leader' | 'decision' | 'reason'
  | 'targetDate' | 'status' | 'correctiveAction';
type FieldDefinition = {
  key: FormKey;
  label: string;
  kind: 'text' | 'number' | 'select' | 'date' | 'multiline';
  optionType?: string;
  placeholder?: string;
};

const fields: FieldDefinition[] = [
  { key: 'scrapDate', label: 'Scrap Date', kind: 'date' },
  { key: 'rejectedOn', label: 'Rejected On', kind: 'date' },
  { key: 'foundAt', label: 'Found At', kind: 'select', optionType: 'foundAt', placeholder: 'Select location' },
  { key: 'leakCode', label: 'Leak Code', kind: 'text', placeholder: 'Enter leak code' },
  { key: 'shift', label: 'Shift', kind: 'select', optionType: 'shifts', placeholder: 'Select shift' },
  { key: 'op', label: 'OP', kind: 'select', optionType: 'operations', placeholder: 'Select OP' },
  { key: 'fixPos', label: 'Fix Pos', kind: 'text', placeholder: 'Enter fix position' },
  { key: 'defectType', label: 'Type of Defect', kind: 'select', optionType: 'defectTypes', placeholder: 'Select defect' },
  { key: 'dimension', label: 'HEX | NO | Nominal', kind: 'select', optionType: 'defectAreas', placeholder: 'Select dimension' },
  { key: 'actual', label: 'Actual', kind: 'number', placeholder: 'Enter actual value' },
  { key: 'qty', label: 'QTY', kind: 'number', placeholder: 'Enter quantity' },
  { key: 'operator', label: 'Operator', kind: 'select', optionType: 'employees', placeholder: 'Select operator' },
  { key: 'leader', label: 'Leader', kind: 'select', optionType: 'employees', placeholder: 'Select leader' },
  { key: 'decision', label: 'Decision', kind: 'select', optionType: 'decisions', placeholder: 'Select decision' },
  { key: 'reason', label: 'Reason for Rejection', kind: 'multiline', placeholder: 'Describe the reason for rejection...' },
  { key: 'targetDate', label: 'Target Date', kind: 'date' },
  { key: 'status', label: 'Status', kind: 'select', optionType: 'entryStatuses', placeholder: 'Select status' },
  { key: 'correctiveAction', label: 'Corrective Action', kind: 'multiline', placeholder: 'Describe the corrective action taken...' },
];

const initialForm: Record<FormKey, string> = {
  scrapDate: '',
  rejectedOn: formatDate(new Date()),
  foundAt: '',
  leakCode: '',
  shift: '',
  shopFloor: '',
  partName: '',
  bhChThIm: '',
  op: '',
  fixPos: '',
  defectType: '',
  dimension: '',
  actual: '',
  qty: '',
  operator: '',
  leader: '',
  decision: '',
  reason: '',
  targetDate: '',
  status: '',
  correctiveAction: '',
};

const optionTypes = ['shifts', 'foundAt', 'defectTypes', 'defectAreas', 'employees', 'operations', 'decisions'];
const entryStatuses: SelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
];

type ScannedPart = { partNo: string; productId: string };

function formatDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function getQrPart(data: string): ScannedPart | null {
  const readObject = (value: Record<string, unknown>): ScannedPart | null => {
    const entries = Object.entries(value);
    const partNo = entries.find(([key]) => [
      'partno', 'castpartno', 'machpartno', 'assypartno', 'shippartno', 'partnumber',
    ].includes(key.replace(/[_\s-]/g, '').toLowerCase()))?.[1];
    const productId = entries.find(([key]) => ['productid', 'product_id', 'id'].includes(key.replace(/[_\s-]/g, '').toLowerCase()))?.[1];
    if (partNo != null && productId != null && String(partNo).trim() && String(productId).trim()) {
      return { partNo: String(partNo).trim(), productId: String(productId).trim() };
    }
    return null;
  };

  try {
    const parsed: unknown = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const part = readObject(parsed as Record<string, unknown>);
      if (part) return part;
    }
  } catch {
  }

  try {
    const parsedUrl = new URL(data);
    const partNo = parsedUrl.searchParams.get('partNo') || parsedUrl.searchParams.get('partno');
    const productId = parsedUrl.searchParams.get('productId') || parsedUrl.searchParams.get('product_id');
    if (partNo && productId) return { partNo: partNo.trim(), productId: productId.trim() };
  } catch {
  }

  const pieces = data.trim().split(/[_|,;\t]/).map((piece) => piece.trim()).filter(Boolean);
  if (pieces.length >= 2) {
    const last = pieces[pieces.length - 1];
    const first = pieces[0];
    if (/^\d+$/.test(last)) return { partNo: pieces.slice(0, -1).join('_'), productId: last };
    if (/^\d+$/.test(first)) return { partNo: pieces.slice(1).join('_'), productId: first };
  }
  return null;
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function createRejectionXml(
  part: ScannedPart,
  form: Record<FormKey, string>,
  createdBy: string,
  details: Record<string, unknown> | null,
) {
  const entries = Object.entries(form).map(([key, value]) => `    <${key}>${xmlEscape(value)}</${key}>`).join('\n');
  const productDetails = details
    ? `\n  <productDetails>\n${Object.entries(details)
      .map(([key, value]) => `    <${key}>${xmlEscape(value == null ? '' : String(value))}</${key}>`)
      .join('\n')}\n  </productDetails>`
    : '';
  return `<RejectionEntry>\n  <productId>${xmlEscape(part.productId)}</productId>\n  <partNo>${xmlEscape(part.partNo)}</partNo>\n  <createdBy>${xmlEscape(createdBy)}</createdBy>\n  <form>\n${entries}\n  </form>${productDetails}\n</RejectionEntry>`;
}

function findDetail(details: Record<string, unknown> | null, keys: string[]) {
  if (!details) return '';
  const normalized = new Map(Object.entries(details).map(([key, value]) => [key.replace(/[^a-z0-9]/gi, '').toLowerCase(), value]));
  for (const key of keys) {
    const value = normalized.get(key.replace(/[^a-z0-9]/gi, '').toLowerCase());
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function extractPartDetails(payload: unknown): Record<string, unknown> | null {
  const candidates: Array<{ record: Record<string, unknown>; score: number; depth: number }> = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 8 || value == null) return;
    if (typeof value === 'string') {
      try {
        visit(JSON.parse(value), depth + 1);
      } catch {
        return;
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length) {
      const normalizedKeys = keys.map((key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase());
      const productFields = [
        'productid', 'project', 'location', 'partdesc', 'customer', 'custlocation',
        'custcity', 'whlocation', 'deliveryloc', 'castwt', 'machwt', 'assywt',
        'castappr', 'machappr', 'assyappr', 'material', 'matlrev', 'createddate',
      ];
      const productFieldCount = productFields.reduce(
        (total, key) => total + (normalizedKeys.includes(key) ? 1 : 0),
        0,
      );
      const primitiveFieldCount = Object.values(record).filter(
        (nested) => nested == null || typeof nested !== 'object',
      ).length;
      const wrapperOnly = normalizedKeys.every((key) =>
        ['data', 'result', 'results', 'record', 'product', 'details', 'rows'].includes(key),
      );
      if (!wrapperOnly && primitiveFieldCount) {
        candidates.push({
          record,
          score: productFieldCount * 100 + primitiveFieldCount,
          depth,
        });
      }
    }
    Object.values(record).forEach((nested) => {
      if (nested && typeof nested === 'object') visit(nested, depth + 1);
    });
  };

  visit(payload, 0);
  candidates.sort((left, right) => right.score - left.score || right.depth - left.depth);
  return candidates[0]?.record || null;
}

async function readPartDetailsResponse(response: Response) {
  const responseText = await response.text();
  let payload: unknown;

  try {
    payload = JSON.parse(responseText);
  } catch {
    if (response.status === 404) {
      throw new Error(
        `Part details API route was not found (HTTP 404) at ${PART_DETAILS_API_URL}. Redeploy the backend with its latest API routes.`,
      );
    }
    throw new Error(
      `Part details API returned a non-JSON response (HTTP ${response.status}) from ${PART_DETAILS_API_URL}. Check that the backend is running and the API route is available.`,
    );
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String(payload.message)
      : `Part details request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

export default function RejectionEntryScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [part, setPart] = useState<ScannedPart | null>(null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(initialForm);
  const [cameraActive, setCameraActive] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [optionLists, setOptionLists] = useState<Record<string, SelectOption[]>>({ entryStatuses });
  const [optionErrors, setOptionErrors] = useState<Record<string, string>>({});
  const [scanError, setScanError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [activeSelect, setActiveSelect] = useState<FormKey | null>(null);
  const [optionSearch, setOptionSearch] = useState('');
  const [activeDate, setActiveDate] = useState<FormKey | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scanLock = useRef(false);
  const submitMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columns = width >= 1180 ? 4 : width >= 700 ? 2 : 1;
  const inputWidth = columns === 1 ? '100%' : `${100 / columns - 1.5}%`;
  const actionsInRow = width >= 390;

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch((error) => {
        console.error('Unable to request camera permission:', error);
        setScanError('Camera permission could not be requested. Check app permissions and try again.');
      });
    }
  }, [permission, requestPermission]);

  useEffect(() => () => {
    if (submitMessageTimer.current) clearTimeout(submitMessageTimer.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    optionTypes.forEach((type) => {
      fetch(OPTIONS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ type }),
        signal: controller.signal,
      }).then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(`Options request (${type}) failed with status ${response.status}.`);
        if (!Array.isArray(payload)) throw new Error(`Options response (${type}) was not a list.`);
        setOptionLists((current) => ({
          ...current,
          [type]: payload.filter((item): item is SelectOption =>
            !!item && typeof item === 'object' && typeof item.label === 'string' && typeof item.value === 'string',
          ),
        }));
        setOptionErrors((current) => ({ ...current, [type]: '' }));
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(`Unable to load rejection options (${type}):`, error);
        setOptionErrors((current) => ({ ...current, [type]: 'Could not load choices. Tap to retry.' }));
      });
    });
    return () => controller.abort();
  }, []);

  const loadPartDetails = useCallback(async (scanned: ScannedPart) => {
    setLookupLoading(true);
    setDetailsError('');
    try {
      const response = await fetch(PART_DETAILS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ productId: scanned.productId, partNo: scanned.partNo }),
      });
      const payload = await readPartDetailsResponse(response);
      const record = extractPartDetails(payload);
      if (!record) {
        setDetails(null);
        setDetailsError(`No Product Matrix details were returned for Product ID ${scanned.productId}.`);
        return;
      }
      setDetails(record);
      setForm((current) => ({
        ...current,
        partName: findDetail(record, ['Project']),
        shopFloor: findDetail(record, ['Location', 'ShopFloor', 'FoundAt']),
        bhChThIm: findDetail(record, ['PartDesc']),
      }));
    } catch (error) {
      console.error('Unable to load scanned part details:', error);
      setDetailsError(error instanceof Error ? error.message : 'Could not load part details.');
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const onBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setCameraActive(false);
    setScanError('');
    const scanned = getQrPart(data);
    if (!scanned) {
      setScanError('QR format was not recognized. It must include partNo and productId.');
      scanLock.current = false;
      return;
    }
    setPart(scanned);
    void loadPartDetails(scanned);
  }, [loadPartDetails]);

  const retryOptions = useCallback(async (type: string) => {
    setOptionErrors((current) => ({ ...current, [type]: '' }));
    try {
      const response = await fetch(OPTIONS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ type }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !Array.isArray(payload)) throw new Error(`Options request (${type}) failed.`);
      setOptionLists((current) => ({
        ...current,
        [type]: payload.filter((item): item is SelectOption =>
          !!item && typeof item === 'object' && typeof item.label === 'string' && typeof item.value === 'string',
        ),
      }));
    } catch (error) {
      console.error(`Unable to reload rejection options (${type}):`, error);
      setOptionErrors((current) => ({ ...current, [type]: 'Could not load choices. Tap to retry.' }));
    }
  }, []);

  const setField = (key: FormKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetScan = () => {
    if (submitMessageTimer.current) clearTimeout(submitMessageTimer.current);
    submitMessageTimer.current = null;
    scanLock.current = false;
    setPart(null);
    setDetails(null);
    setDetailsError('');
    setScanError('');
    setShowDetails(false);
    setForm(initialForm);
    setSubmitMessage('');
    setCameraActive(true);
  };

  const submit = async () => {
    if (!part) return;
    Keyboard.dismiss();
    setSubmitting(true);
    setSubmitMessage('');
    try {
      const [username, employeeId] = await Promise.all([
        SecureStore.getItemAsync('full_name'),
        SecureStore.getItemAsync('employee_id'),
      ]);
      if (!username || !employeeId) {
        throw new Error('Could not read the logged-in username and employee ID. Please sign in again.');
      }
      const response = await fetch(REJECTION_SUBMIT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8', Accept: 'application/json' },
        body: createRejectionXml(part, form, `${username}|${employeeId}`, details),
      });
      const responseText = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error(`Submit API returned a non-JSON response (HTTP ${response.status}).`);
      }
      if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'message' in payload
          ? String(payload.message)
          : `Submit failed with status ${response.status}.`;
        throw new Error(message);
      }
      if (submitMessageTimer.current) clearTimeout(submitMessageTimer.current);
      scanLock.current = false;
      setPart(null);
      setDetails(null);
      setDetailsError('');
      setScanError('');
      setShowDetails(false);
      setForm(initialForm);
      setCameraActive(true);
      setSubmitMessage('Submitted successfully.');
      submitMessageTimer.current = setTimeout(() => {
        setSubmitMessage('');
        submitMessageTimer.current = null;
      }, 2500);
    } catch (error) {
      console.error('Unable to submit rejection entry:', error);
      setSubmitMessage(error instanceof Error ? error.message : 'Unable to submit rejection entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const detailsRows = useMemo(() => {
    if (!details) return [];
    return [
      { key: 'Project', label: 'Part Name', value: findDetail(details, ['Project']) },
      { key: 'PartDesc', label: 'BH / TH / CH / IM', value: findDetail(details, ['PartDesc']) },
      { key: 'Location', label: 'Shop Floor', value: findDetail(details, ['Location']) },
      { key: 'Customer', label: 'Customer', value: findDetail(details, ['Customer']) },
    ].filter((row) => row.value !== '');
  }, [details]);

  useEffect(() => {
    if (permission?.granted && !part) setCameraActive(true);
  }, [part, permission?.granted]);

  const renderField = (field: FieldDefinition) => {
    const value = form[field.key];
    const fieldStyle = [
      styles.fieldControl,
      { borderColor: colors.border, backgroundColor: colors.surfaceSolid },
    ];

    return (
      <View key={field.key} style={[styles.field, { width: inputWidth as `${number}%` }]}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>{field.label}</Text>
        {field.kind === 'select' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (optionErrors[field.optionType || '']) {
                void retryOptions(field.optionType || '');
                return;
              }
              setActiveSelect(field.key);
            }}
            style={({ pressed }) => [fieldStyle, styles.selectControl, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.controlText, { color: value ? colors.text : colors.muted }]}>
              {value || field.placeholder}
            </Text>
            {optionErrors[field.optionType || ''] ? (
              <Ionicons name="refresh-outline" size={17} color={colors.danger} />
            ) : (
              <Ionicons name="chevron-down" size={17} color={colors.muted} />
            )}
          </Pressable>
        ) : field.kind === 'date' ? (
          <>
            <Pressable onPress={() => setActiveDate(field.key)} style={({ pressed }) => [fieldStyle, styles.selectControl, pressed && styles.pressed]}>
              <Ionicons name="calendar-outline" size={17} color={colors.muted} />
              <Text style={[styles.controlText, { color: value ? colors.text : colors.muted }]}>
                {value || 'Pick a date'}
              </Text>
            </Pressable>
          </>
        ) : (
          <TextInput
            value={value}
            onChangeText={(text) => setField(field.key, text)}
            placeholder={field.placeholder}
            placeholderTextColor={colors.muted}
            keyboardType={field.kind === 'number' ? 'decimal-pad' : 'default'}
            multiline={field.kind === 'multiline'}
            textAlignVertical={field.kind === 'multiline' ? 'top' : 'center'}
            style={[
              fieldStyle,
              styles.textControl,
              field.kind === 'multiline' && styles.multilineControl,
              { color: colors.text },
            ]}
          />
        )}
        {field.kind === 'select' && optionErrors[field.optionType || ''] ? (
          <Text style={[styles.fieldError, { color: colors.danger }]}>{optionErrors[field.optionType || '']}</Text>
        ) : null}
      </View>
    );
  };

  const currentSelect = fields.find((field) => field.key === activeSelect);
  const currentOptions = currentSelect?.optionType ? optionLists[currentSelect.optionType] || [] : [];
  const filteredOptions = useMemo(() => {
    const query = optionSearch.trim().toLocaleLowerCase();
    if (!query) return currentOptions;
    return currentOptions.filter((option) => option.label.toLocaleLowerCase().includes(query));
  }, [currentOptions, optionSearch]);

  return (
    <AppScreen title="Rejection Entry" subtitle="Scan a part number, then enter the rejection details.">
      <View style={[styles.scanCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
        <View style={styles.sectionHeading}>
          <View style={[styles.headingIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="qr-code-outline" size={21} color={colors.accent} />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Scan Part Number</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>Point the camera at the part QR code.</Text>
          </View>
          {part ? (
            <Pressable onPress={resetScan} accessibilityRole="button" accessibilityLabel="Scan another part">
              <Ionicons name="scan-outline" size={22} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>

        {part ? (
          <View style={[styles.scannedPart, { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.scannedIcon, { backgroundColor: colors.surfaceSolid }]}>
              <Ionicons name="cube-outline" size={21} color={colors.accent} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={[styles.scannedLabel, { color: colors.muted }]}>PART NUMBER</Text>
              <Text style={[styles.scannedNumber, { color: colors.text }]}>{part.partNo}</Text>
              <Text style={[styles.scannedMeta, { color: colors.muted }]}>Product ID · {part.productId}</Text>
            </View>
            {lookupLoading ? <ActivityIndicator color={colors.accent} /> : null}
          </View>
        ) : permission?.granted ? (
          <>
            {cameraActive ? (
              <View style={[styles.cameraFrame, { borderColor: colors.border }]}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onBarcodeScanned}
                />
                <View pointerEvents="none" style={styles.scanOverlay}>
                  <View style={[styles.scanCorner, styles.scanCornerTopLeft, { borderColor: colors.accent }]} />
                  <View style={[styles.scanCorner, styles.scanCornerTopRight, { borderColor: colors.accent }]} />
                  <View style={[styles.scanCorner, styles.scanCornerBottomLeft, { borderColor: colors.accent }]} />
                  <View style={[styles.scanCorner, styles.scanCornerBottomRight, { borderColor: colors.accent }]} />
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setCameraActive(true)} style={({ pressed }) => [styles.startScan, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
                <Ionicons name="scan-outline" size={21} color="#fff" />
                <Text style={styles.startScanText}>Open Scanner</Text>
              </Pressable>
            )}
          </>
        ) : permission?.canAskAgain === false ? (
          <View style={styles.permissionMessage}>
            <Text style={[styles.errorText, { color: colors.danger }]}>Camera permission is disabled. Enable it in device settings to scan a part.</Text>
          </View>
        ) : (
          <View style={styles.permissionMessage}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>Requesting camera permission…</Text>
          </View>
        )}

        {scanError ? <Text style={[styles.errorText, { color: colors.danger }]}>{scanError}</Text> : null}
        {detailsError ? <Text style={[styles.errorText, { color: colors.danger }]}>{detailsError}</Text> : null}
        {part ? (
          <Pressable
            onPress={() => setShowDetails((current) => !current)}
            style={[styles.detailsToggle, { borderTopColor: colors.border }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
          >
            <Text style={[styles.detailsToggleLabel, { color: colors.accent }]}>{showDetails ? 'Hide more details' : 'Show more details'}</Text>
            <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={17} color={colors.accent} />
          </Pressable>
        ) : null}
        {part && showDetails ? (
          <View style={styles.detailsGrid}>
            {detailsRows.length ? detailsRows.map((row) => (
              <View key={row.key} style={[styles.detailItem, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{row.label}</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{row.value}</Text>
              </View>
            )) : (
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                {lookupLoading ? 'Loading…' : detailsError || 'No additional details were returned for this part.'}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {part ? (
        <View style={[styles.formCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
          <View style={styles.formHeading}>
            <View style={[styles.headingIcon, { backgroundColor: `${colors.danger}18` }]}>
              <Ionicons name="clipboard-outline" size={21} color={colors.danger} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Rejection Details</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>Complete the fields for this rejection entry.</Text>
            </View>
          </View>
          <View style={styles.fieldsGrid}>{fields.map(renderField)}</View>
          <View style={[styles.formActions, { flexDirection: actionsInRow ? 'row' : 'column' }]}>
            <Pressable onPress={() => setForm(initialForm)} style={({ pressed }) => [
              styles.resetButton,
              actionsInRow ? styles.actionButtonHalf : styles.actionButtonFull,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}>
              <Ionicons name="refresh-outline" size={17} color={colors.muted} />
              <Text style={[styles.resetButtonText, { color: colors.text }]}>Reset Form</Text>
            </Pressable>
            <Pressable
              onPress={() => void submit()}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitButton,
                actionsInRow ? styles.actionButtonHalf : styles.actionButtonFull,
                { backgroundColor: colors.accent },
                pressed && styles.pressed,
                submitting && styles.disabled,
              ]}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitButtonText}>Submit Rejection</Text>}
              {!submitting ? <Ionicons name="arrow-forward" size={17} color="#fff" /> : null}
            </Pressable>
          </View>
        </View>
      ) : null}

      {submitMessage ? (
        <View style={[styles.submitNotice, { backgroundColor: submitMessage.includes('successfully') ? colors.accentSoft : `${colors.danger}12` }]}>
          <Ionicons
            name={submitMessage.includes('successfully') ? 'checkmark-circle-outline' : 'information-circle-outline'}
            size={19}
            color={submitMessage.includes('successfully') ? colors.accent : colors.danger}
          />
          <Text style={[styles.submitNoticeText, { color: colors.text }]}>{submitMessage}</Text>
        </View>
      ) : null}

      <Modal
        transparent
        visible={!!activeSelect}
        animationType="slide"
        onShow={() => setOptionSearch('')}
        onRequestClose={() => {
          setActiveSelect(null);
          setOptionSearch('');
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setActiveSelect(null);
            setOptionSearch('');
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.optionSheet, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{currentSelect?.label || 'Select an option'}</Text>
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                value={optionSearch}
                onChangeText={setOptionSearch}
                placeholder="Search options"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={`Search ${currentSelect?.label || 'options'}`}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {optionSearch ? (
                <Pressable onPress={() => setOptionSearch('')} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
              {filteredOptions.map((option) => (
                <Pressable
                  key={`${option.value}:${option.label}`}
                  onPress={() => {
                    if (activeSelect) setField(activeSelect, option.label);
                    setActiveSelect(null);
                    setOptionSearch('');
                  }}
                  style={({ pressed }) => [styles.optionRow, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.accentSoft }]}
                >
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                  {activeSelect && form[activeSelect] === option.label ? <Ionicons name="checkmark" size={19} color={colors.accent} /> : null}
                </Pressable>
              ))}
              {!currentOptions.length ? (
                <Text style={[styles.noOptions, { color: colors.muted }]}>
                  {currentSelect?.optionType && optionErrors[currentSelect.optionType] ? optionErrors[currentSelect.optionType] : 'No options available.'}
                </Text>
              ) : null}
              {!!currentOptions.length && !filteredOptions.length ? (
                <Text style={[styles.noOptions, { color: colors.muted }]}>No matching options.</Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <DateTimePickerModal
        isVisible={!!activeDate}
        mode="date"
        date={activeDate && form[activeDate] ? (() => {
          const [day, month, year] = form[activeDate].split('/').map(Number);
          return new Date(year, month - 1, day);
        })() : new Date()}
        onConfirm={(date) => {
          if (activeDate) setField(activeDate, formatDate(date));
          setActiveDate(null);
        }}
        onCancel={() => setActiveDate(null)}
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scanCard: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  headingIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  headingCopy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionSubtitle: { fontSize: 11, lineHeight: 16 },
  cameraFrame: { height: 280, overflow: 'hidden', borderWidth: 1, borderRadius: 18, backgroundColor: '#10191e' },
  scanOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  scanCorner: { position: 'absolute', width: 42, height: 42, borderWidth: 4 },
  scanCornerTopLeft: { top: '25%', left: '18%', borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  scanCornerTopRight: { top: '25%', right: '18%', borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  scanCornerBottomLeft: { bottom: '25%', left: '18%', borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  scanCornerBottomRight: { bottom: '25%', right: '18%', borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  startScan: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 15 },
  startScanText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  permissionMessage: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 10 },
  scannedPart: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 17 },
  scannedIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  scannedLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  scannedNumber: { fontSize: 17, fontWeight: '800', marginTop: 3 },
  scannedMeta: { fontSize: 10, marginTop: 3 },
  errorText: { marginTop: 10, fontSize: 11, lineHeight: 16 },
  detailsToggle: { minHeight: 46, marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 13 },
  detailsToggleLabel: { fontSize: 12, fontWeight: '700' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  detailItem: { width: '48%', minHeight: 53, padding: 10, borderRadius: 12 },
  detailLabel: { fontSize: 9, fontWeight: '600', marginBottom: 4, textTransform: 'capitalize' },
  detailValue: { fontSize: 11, fontWeight: '600' },
  formCard: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 22 },
  formHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 15 },
  field: { minWidth: 0 },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: 7 },
  fieldControl: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 },
  selectControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  controlText: { flex: 1, fontSize: 12 },
  textControl: { paddingVertical: 10, fontSize: 12 },
  multilineControl: { minHeight: 76, paddingTop: 11 },
  fieldError: { marginTop: 4, fontSize: 9 },
  pressed: { opacity: 0.76 },
  submitNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 12, marginTop: 18 },
  submitNoticeText: { flex: 1, fontSize: 11, lineHeight: 16 },
  formActions: { gap: 10, marginTop: 22 },
  resetButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  resetButtonText: { fontSize: 12, fontWeight: '700' },
  submitButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16, borderRadius: 12 },
  actionButtonHalf: { flex: 1 },
  actionButtonFull: { width: '100%' },
  submitButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.65 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  optionSheet: { maxHeight: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24 },
  sheetHandle: { width: 42, height: 4, alignSelf: 'center', borderRadius: 3, marginBottom: 15 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  searchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  searchInput: { flex: 1, minHeight: 42, paddingVertical: 8, fontSize: 13 },
  optionList: { flexGrow: 0 },
  optionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5 },
  optionLabel: { fontSize: 13 },
  noOptions: { fontSize: 12, paddingVertical: 22, textAlign: 'center' },
});
