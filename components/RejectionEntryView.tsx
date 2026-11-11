import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Keyboard,
  KeyboardAvoidingView,
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
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScreen } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { verifyLocationForScreen } from '@/utils/locationVerifier';

const OPTIONS_API_URL = 'https://gtiappsbackend.vercel.app/api/casting-rejection/get-options';
const DIMENSIONS_OPTIONS_API_URL = 'https://gtiappsbackend.vercel.app/api/MG_Daily_Rejection/options/get-options';
const BACKEND_BASE_URL = 'https://gtiappsbackend.vercel.app';
const PART_DETAILS_API_URL = `${BACKEND_BASE_URL}/api/product-matrix/part-details`;
const REJECTION_SUBMIT_API_URL = `${BACKEND_BASE_URL}/api/rejection/save`;
const REJECTION_GET_API_URL = `${BACKEND_BASE_URL}/api/rejection/get`;
const PROJECT_TRANSIDS_API_URL = `${BACKEND_BASE_URL}/api/rejection/project-transids`;

function getOptionsApiUrl(type: string) {
  return type === 'dimensions' ? DIMENSIONS_OPTIONS_API_URL : OPTIONS_API_URL;
}

export type SelectOption = { value: string; label: string };
export type FormKey =
  | 'scrapDate' | 'rejectedOn' | 'foundAt' | 'leakCode' | 'shift' | 'shopFloor'
  | 'partName' | 'bhChThIm' | 'op' | 'fixPos' | 'defectType' | 'dimension'
  | 'actual' | 'qty' | 'operator' | 'leader' | 'decision' | 'scrapType' | 'reason' | 'returnReason'
  | 'targetDate' | 'status' | 'correctiveAction';
export type ActiveSelectKey = FormKey | 'templateTransId';
export type EntrySection = 'production' | 'qc';
export type FieldDefinition = {
  key: FormKey;
  label: string;
  kind: 'text' | 'number' | 'select' | 'date' | 'multiline';
  optionType?: string;
  placeholder?: string;
};

export const fields: FieldDefinition[] = [
  { key: 'scrapDate', label: 'Scrap Date', kind: 'date' },
  { key: 'decision', label: 'Decision', kind: 'select', optionType: 'decisions', placeholder: 'Select decision' },
  { key: 'scrapType', label: 'Scrap Type', kind: 'select', optionType: 'scrapTypes', placeholder: 'Select scrap type' },
  { key: 'rejectedOn', label: 'Rejected On', kind: 'date' },
  { key: 'foundAt', label: 'Found At', kind: 'select', optionType: 'foundAt', placeholder: 'Select location' },
  { key: 'leakCode', label: 'Leak Code', kind: 'text', placeholder: 'Enter leak code' },
  { key: 'shift', label: 'Shift', kind: 'select', optionType: 'shifts', placeholder: 'Select shift' },
  { key: 'op', label: 'OP', kind: 'select', optionType: 'operations', placeholder: 'Select OP' },
  { key: 'fixPos', label: 'Fix Pos', kind: 'text', placeholder: 'Enter fix position' },
  { key: 'defectType', label: 'Type of Defect', kind: 'select', optionType: 'defectTypes', placeholder: 'Select defect' },
  { key: 'dimension', label: 'HEX | NO | Nominal (Optional)', kind: 'select', optionType: 'dimensions', placeholder: 'Select dimension' },
  { key: 'actual', label: 'Actual', kind: 'number', placeholder: 'Enter actual value' },
  { key: 'qty', label: 'QTY', kind: 'number', placeholder: 'Enter quantity' },
  { key: 'operator', label: 'Operator', kind: 'select', optionType: 'employees', placeholder: 'Select operator' },
  { key: 'leader', label: 'Leader', kind: 'select', optionType: 'employees', placeholder: 'Select leader' },
  { key: 'reason', label: 'Reason for Rejection', kind: 'multiline', placeholder: 'Describe the reason for rejection...' },
  { key: 'returnReason', label: 'Reason for Return', kind: 'multiline', placeholder: 'Describe the reason for return...' },
  { key: 'targetDate', label: 'Target Date', kind: 'date' },
  { key: 'status', label: 'Status', kind: 'select', optionType: 'entryStatuses', placeholder: 'Select status' },
  { key: 'correctiveAction', label: 'Corrective Action', kind: 'multiline', placeholder: 'Describe the corrective action taken...' },
];

export const qcFieldKeys: FormKey[] = [
  'scrapDate',
  'decision',
  'scrapType',
  'foundAt',
  'returnReason',
  'correctiveAction',
  'targetDate',
  'status',
];
export const productionFields = fields.filter((field) => !qcFieldKeys.includes(field.key));
export const qcFields = qcFieldKeys
  .map((key) => fields.find((field) => field.key === key))
  .filter((field): field is FieldDefinition => Boolean(field));

export const initialForm: Record<FormKey, string> = {
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
  qty: '1',
  operator: '',
  leader: '',
  decision: '',
  scrapType: '',
  reason: '',
  returnReason: '',
  targetDate: '',
  status: '',
  correctiveAction: '',
};

export const independentOptionTypes = ['shifts', 'foundAt', 'defectTypes', 'operations', 'decisions', 'scrapTypes'];
export const productOptionTypes = ['dimensions', 'employees'];
export const optionTypes = [...independentOptionTypes, ...productOptionTypes];
export const entryStatuses: SelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
];

export type ScannedPart = { transId: string; partNo: string; serialNo: string; productId?: string };

export function formatDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function getQrPart(data: string): ScannedPart | null {
  const transId = data.trim();
  let separator = transId.lastIndexOf('|');
  if (separator <= 0 || separator === transId.length - 1) {
    separator = transId.lastIndexOf('_');
  }
  if (separator <= 0 || separator === transId.length - 1) return null;

  const partNo = transId.slice(0, separator).trim();
  const serialNo = transId.slice(separator + 1).trim();
  if (!partNo || !serialNo) return null;

  return { transId, partNo, serialNo };
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function createRejectionXml(
  part: ScannedPart,
  form: Record<FormKey, string>,
  createdBy: string,
) {
  const entries = Object.entries(form).map(([key, value]) => `    <${key}>${xmlEscape(value)}</${key}>`).join('\n');
  return `<RejectionEntry>\n  <productId>${xmlEscape(part.productId || '')}</productId>\n  <partNo>${xmlEscape(part.partNo)}</partNo>\n  <transId>${xmlEscape(part.transId)}</transId>\n  <serialNo>${xmlEscape(part.serialNo)}</serialNo>\n  <createdBy>${xmlEscape(createdBy)}</createdBy>\n  <form>\n${entries}\n  </form>\n</RejectionEntry>`;
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

const rejectionColumnToFormKey: Record<string, FormKey> = {
  ScrapDate: 'scrapDate',
  RejectedOn: 'rejectedOn',
  FoundAt: 'foundAt',
  LeakCode: 'leakCode',
  Shift: 'shift',
  ShopFloor: 'shopFloor',
  PartName: 'partName',
  BhChThIm: 'bhChThIm',
  OP: 'op',
  FixPos: 'fixPos',
  DefectType: 'defectType',
  Dimension: 'dimension',
  Actual: 'actual',
  Qty: 'qty',
  OperatorName: 'operator',
  LeaderName: 'leader',
  Decision: 'decision',
  ScrapType: 'scrapType',
  RejectionReason: 'reason',
  TargetDate: 'targetDate',
  Status: 'status',
  CorrectiveAction: 'correctiveAction',
  ReturnReason: 'returnReason',
};

const productionCompleteColumns: string[] = [
  'RejectedOn', 'LeakCode', 'Shift', 'ShopFloor', 'PartName', 'BhChThIm',
  'OP', 'FixPos', 'DefectType', 'Qty',
  'OperatorName', 'LeaderName', 'RejectionReason',
];

const qcCompleteColumns: string[] = [
  'ScrapDate', 'Decision', 'ScrapType', 'FoundAt', 'ReturnReason', 'CorrectiveAction', 'TargetDate', 'Status',
];

function isSectionCompleteFromRecord(record: Record<string, unknown>, columns: string[]): boolean {
  return columns.every((column) => {
    const value = record[column];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
}

function isSectionFormComplete(
  section: EntrySection,
  form: Record<FormKey, string>,
  part: ScannedPart | null,
): boolean {
  const columns = section === 'production' ? productionCompleteColumns : qcCompleteColumns;
  return columns.every((column) => {
    const key = rejectionColumnToFormKey[column];
    if (!key) return false;
    let value = form[key];
    if (key === 'leakCode' && part) {
      value = `${part.partNo}|${part.serialNo}`;
    } else if (key === 'qty') {
      value = value || '1';
    }
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function rejectionValueToForm(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value);
  if (typeof value === 'string') {
    const dateMatch = value.match(/^\s*(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) return `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
    return value;
  }
  return String(value);
}

function normalizeTemplateSearchText(text: string): string {
  return text.trim().toLowerCase().replace(/\s*([|_])\s*/g, '$1').replace(/\s+/g, ' ');
}

function parseTransIdParts(transId: string): { partNo: string; serialNo: string } {
  const clean = transId.trim();
  const separator = clean.includes('|') ? '|' : clean.includes('_') ? '_' : '';
  const separatorIndex = separator ? clean.lastIndexOf(separator) : -1;
  if (separatorIndex > 0) {
    return {
      partNo: clean.slice(0, separatorIndex).trim(),
      serialNo: clean.slice(separatorIndex + 1).trim(),
    };
  }
  return { partNo: clean, serialNo: '' };
}

function getTemplateOptionRank(option: SelectOption, queryNorm: string, queryTokens: string[]): number {
  const labelNorm = option.label.trim().toLowerCase();
  const { partNo: partNoNorm, serialNo: serialNoNorm } = parseTransIdParts(labelNorm);
  const labelWithUnderscore = labelNorm.replace(/\|/g, '_');

  if (labelNorm === queryNorm || labelWithUnderscore === queryNorm) return 0;
  if (serialNoNorm && serialNoNorm === queryNorm) return 1;
  if (partNoNorm && partNoNorm === queryNorm) return 2;
  if (serialNoNorm && serialNoNorm.startsWith(queryNorm)) return 3;
  if (partNoNorm && partNoNorm.startsWith(queryNorm)) return 4;
  if (labelNorm.startsWith(queryNorm) || labelWithUnderscore.startsWith(queryNorm)) return 5;
  if (labelNorm.includes(queryNorm) || labelWithUnderscore.includes(queryNorm)) return 6;
  if (queryTokens.length > 1 && queryTokens.every((token) => labelNorm.includes(token))) return 7;
  return -1;
}

export type RejectionEntryViewProps = {
  initialPart?: ScannedPart | null;
  onClose?: () => void;
  onSaved?: () => void;
  hideScanner?: boolean;
};

export function RejectionEntryView({
  initialPart,
  onClose,
  onSaved,
  hideScanner = false,
}: RejectionEntryViewProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [part, setPart] = useState<ScannedPart | null>(initialPart || null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(initialForm);
  const [cameraActive, setCameraActive] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchZoom = useRef<number>(0);
  const sliderTouchStartX = useRef<number>(0);
  const sliderTouchStartZoom = useRef<number>(0);
  const HORIZONTAL_SLIDER_WIDTH = 180;
  const [lookupLoading, setLookupLoading] = useState(false);
  const [savedEntryLoading, setSavedEntryLoading] = useState(false);
  const [optionLists, setOptionLists] = useState<Record<string, SelectOption[]>>({ entryStatuses });
  const [optionErrors, setOptionErrors] = useState<Record<string, string>>({});
  const [optionLoading, setOptionLoading] = useState<Record<string, boolean>>({});
  const [projectName, setProjectName] = useState('');
  const [templateOptions, setTemplateOptions] = useState<SelectOption[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [selectedTemplateTransId, setSelectedTemplateTransId] = useState('');
  const [initialSavedForm, setInitialSavedForm] = useState<Record<FormKey, string> | null>(null);
  const [initialCompletedSections, setInitialCompletedSections] = useState<Record<EntrySection, boolean>>({
    production: false,
    qc: false,
  });
  const loadedTemplateProjectRef = useRef('');
  const [scanError, setScanError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [activeSelect, setActiveSelect] = useState<ActiveSelectKey | null>(null);
  const [optionSearch, setOptionSearch] = useState('');
  const [activeDate, setActiveDate] = useState<FormKey | null>(null);
  const [activeSection, setActiveSection] = useState<EntrySection>('production');
  const [completedSections, setCompletedSections] = useState<Record<EntrySection, boolean>>({
    production: false,
    qc: false,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginType, setLoginType] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scanLock = useRef(false);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const fieldOffsets = useRef<Record<string, number>>({});
  const formCardY = useRef(0);
  const lastFocusedField = useRef<FormKey | null>(null);
  const columns = width >= 1180 ? 4 : width >= 700 ? 2 : 1;
  const inputWidth = columns === 1 ? '100%' : `${100 / columns - 1.5}%`;
  const actionsInRow = width >= 390;
  const allSectionsComplete = completedSections.production && completedSections.qc;
  const sectionFields = activeSection === 'production' ? productionFields : qcFields;
  const sectionComplete = completedSections[activeSection];
  const isScanning = cameraActive && !hideScanner && !part;

  const scrollToField = useCallback((key: FormKey) => {
    const offset = fieldOffsets.current[key];
    if (offset !== undefined && scrollViewRef.current) {
      const targetY = Math.max(0, formCardY.current + offset - 40);
      scrollViewRef.current.scrollTo({ y: targetY, animated: true });
    } else {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        if (lastFocusedField.current) {
          setTimeout(() => {
            if (lastFocusedField.current) {
              scrollToField(lastFocusedField.current);
            }
          }, 60);
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToField]);

  const isAdmin = loginType === 'admin';
  const isProd = loginType === 'prod';
  const isQC = loginType === 'qc';

  const canEditSection = useCallback((section: EntrySection) => {
    if (isAdmin) return true;
    if (isProd) return section === 'production' && !completedSections.production;
    if (isQC) return section === 'qc' && !completedSections.qc;
    return false;
  }, [isAdmin, isProd, isQC, completedSections.production, completedSections.qc]);

  const isCurrentSectionEditable = canEditSection(activeSection);
  const formLocked = !isCurrentSectionEditable;

  const sectionFormComplete = useMemo(() => {
    return isSectionFormComplete(activeSection, form, part);
  }, [activeSection, form, part]);

  const canSubmit = !submitting && !formLocked && !lookupLoading && !!part?.productId && sectionFormComplete;

  const handleHorizontalSliderGrant = (e: GestureResponderEvent) => {
    sliderTouchStartX.current = e.nativeEvent.pageX;
    const clampedX = Math.max(0, Math.min(HORIZONTAL_SLIDER_WIDTH, e.nativeEvent.locationX));
    const directZoom = Number((clampedX / HORIZONTAL_SLIDER_WIDTH).toFixed(2));
    const targetZoom = Math.min(1, Math.max(0, directZoom));
    sliderTouchStartZoom.current = targetZoom;
    setZoom(targetZoom);
  };

  const handleHorizontalSliderMove = (e: GestureResponderEvent) => {
    const deltaX = e.nativeEvent.pageX - sliderTouchStartX.current;
    const zoomDelta = deltaX / HORIZONTAL_SLIDER_WIDTH;
    const nextZoom = Math.min(1, Math.max(0, sliderTouchStartZoom.current + zoomDelta));
    setZoom(Number(nextZoom.toFixed(2)));
  };

  const stepZoom = (delta: number) => {
    setZoom((prev) => Math.min(1, Math.max(0, Number((prev + delta).toFixed(2)))));
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (e.nativeEvent.touches.length === 2) {
      const [t1, t2] = e.nativeEvent.touches;
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      initialPinchDist.current = dist;
      initialPinchZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (e.nativeEvent.touches.length === 2) {
      const [t1, t2] = e.nativeEvent.touches;
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      if (initialPinchDist.current === null || initialPinchDist.current <= 0) {
        initialPinchDist.current = dist;
        initialPinchZoom.current = zoom;
        return;
      }
      const factor = dist / initialPinchDist.current;
      const delta = (factor - 1) * 0.8;
      const nextZoom = Math.min(1, Math.max(0, initialPinchZoom.current + delta));
      setZoom(Number(nextZoom.toFixed(2)));
    }
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    if (e.nativeEvent.touches.length < 2) {
      initialPinchDist.current = null;
    }
  };

  useEffect(() => {
    SecureStore.getItemAsync('logintype').then(async (val) => {
      const resolved = val || (await SecureStore.getItemAsync('tl'));
      const type = (resolved || '').trim().toLowerCase();
      setLoginType(type);
      if (type === 'qc') {
        setActiveSection('qc');
      } else if (type === 'prod') {
        setActiveSection('production');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    independentOptionTypes.forEach((type) => {
      setOptionLoading((current) => ({ ...current, [type]: true }));
      fetch(getOptionsApiUrl(type), {
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
      }).finally(() => {
        if (controller.signal.aborted) return;
        setOptionLoading((current) => ({ ...current, [type]: false }));
      });
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!part?.productId) return;
    const currentProductId = part.productId;
    const controller = new AbortController();
    productOptionTypes.forEach((type) => {
      setOptionLoading((current) => ({ ...current, [type]: true }));
      setOptionErrors((current) => ({ ...current, [type]: '' }));
      fetch(getOptionsApiUrl(type), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ type, productId: currentProductId }),
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
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(`Unable to load rejection options (${type}):`, error);
        setOptionErrors((current) => ({ ...current, [type]: 'Could not load choices. Tap to retry.' }));
      }).finally(() => {
        if (controller.signal.aborted) return;
        setOptionLoading((current) => ({ ...current, [type]: false }));
      });
    });
    return () => controller.abort();
  }, [part?.productId]);

  const loadPartDetails = useCallback(async (scanned: ScannedPart) => {
    setLookupLoading(true);
    setDetailsError('');
    try {
      const response = await fetch(PART_DETAILS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ partNo: scanned.partNo, transId: scanned.transId }),
      });
      const payload = await readPartDetailsResponse(response);
      const record = extractPartDetails(payload);
      if (!record) {
        setDetails(null);
        setProjectName('');
        setDetailsError(`No Product Matrix details were returned for part number ${scanned.partNo}.`);
        return;
      }
      const productId = findDetail(record, ['Product_Id', 'ProductId']);
      if (!/^\d+$/.test(productId)) {
        setDetails(null);
        setProjectName('');
        setDetailsError(`No valid Product ID was returned for part number ${scanned.partNo}.`);
        return;
      }
      const resolvedProject = findDetail(record, ['Project']);
      setDetails(record);
      setProjectName(resolvedProject);
      setPart({ ...scanned, productId });
      setForm((current) => ({
        ...current,
        leakCode: `${scanned.partNo}|${scanned.serialNo}`,
        qty: '1',
        partName: String(findDetail(record, ['Project', 'PartName', 'ProductName']) ?? ''),
        shopFloor: String(findDetail(record, ['Location', 'ShopFloor', 'FoundAt']) ?? ''),
        bhChThIm: String(findDetail(record, ['PartDesc', 'Description']) ?? ''),
      }));
    } catch (error) {
      console.error('Unable to load scanned part details:', error);
      setDetailsError(error instanceof Error ? error.message : 'Could not load part details.');
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const fetchSavedRejection = useCallback(async (transId: string): Promise<Record<string, unknown>> => {
    const target = `${REJECTION_GET_API_URL}?transId=${encodeURIComponent(transId)}`;
    const response = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `Refetch failed (HTTP ${response.status}).`;
      throw new Error(message);
    }
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !payload.data || typeof payload.data !== 'object') {
      throw new Error('The rejection entry response did not contain a data record.');
    }
    return payload.data as Record<string, unknown>;
  }, []);

  const fetchProjectTransIds = useCallback(async (project: string) => {
    const cleanProject = project.trim();
    if (!cleanProject) {
      setTemplateOptions([]);
      return;
    }
    setTemplateLoading(true);
    setTemplateError('');
    try {
      const response = await fetch(PROJECT_TRANSIDS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ project: cleanProject }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'message' in payload
          ? String(payload.message)
          : `Template options request failed (HTTP ${response.status}).`;
        throw new Error(message);
      }
      const rawList = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && 'data' in payload && Array.isArray(payload.data)
        ? payload.data
        : null;
      if (!rawList) {
        throw new Error('Template options response was not a list.');
      }
      const parsed = rawList.filter((item): item is SelectOption =>
        !!item && typeof item === 'object' && typeof item.label === 'string' && typeof item.value === 'string',
      );
      setTemplateOptions(parsed);
      loadedTemplateProjectRef.current = cleanProject;
    } catch (error) {
      console.error('Unable to load project template transIds:', error);
      setTemplateError(error instanceof Error ? error.message : 'Could not load project history.');
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!projectName || savedEntryLoading || lookupLoading || !isCurrentSectionEditable) return;
    if (loadedTemplateProjectRef.current === projectName) return;
    void fetchProjectTransIds(projectName);
  }, [projectName, savedEntryLoading, lookupLoading, isCurrentSectionEditable, fetchProjectTransIds]);

  const loadPart = useCallback(async (scanned: ScannedPart) => {
    setSavedEntryLoading(true);
    setActiveSection(isQC ? 'qc' : 'production');
    setCompletedSections({ production: false, qc: false });
    setInitialSavedForm(null);
    setInitialCompletedSections({ production: false, qc: false });
    setProjectName('');
    setTemplateOptions([]);
    setTemplateError('');
    setSelectedTemplateTransId('');
    loadedTemplateProjectRef.current = '';
    setSubmitMessage('');
    setForm({ ...initialForm, leakCode: `${scanned.partNo}|${scanned.serialNo}`, qty: '1' });
    setPart(scanned);
    setOptionLists((current) => ({
      ...current,
      employees: [],
      dimensions: [],
    }));
    try {
      await loadPartDetails(scanned);
      try {
        const saved = await fetchSavedRejection(scanned.transId);
        const baseline: Record<FormKey, string> = {
          ...initialForm,
          rejectedOn: '',
          leakCode: `${scanned.partNo}|${scanned.serialNo}`,
          qty: '1',
        };
        for (const [column, key] of Object.entries(rejectionColumnToFormKey)) {
          if (saved[column] === undefined || saved[column] === null) continue;
          const value = rejectionValueToForm(saved[column]);
          if (value.trim()) baseline[key] = value;
        }
        setInitialSavedForm(baseline);
        setForm((current) => {
          const next = { ...current };
          for (const [column, key] of Object.entries(rejectionColumnToFormKey)) {
            if (saved[column] === undefined || saved[column] === null) continue;
            const value = rejectionValueToForm(saved[column]);
            if (value.trim()) next[key] = value;
          }
          next.leakCode = `${scanned.partNo}|${scanned.serialNo}`;
          next.qty = '1';
          return next;
        });
        const productionDone = isSectionCompleteFromRecord(saved, productionCompleteColumns);
        const qcDone = isSectionCompleteFromRecord(saved, qcCompleteColumns);
        setCompletedSections({ production: productionDone, qc: qcDone });
        setInitialCompletedSections({ production: productionDone, qc: qcDone });
        if (isQC) {
          setActiveSection('qc');
        } else if (isProd) {
          setActiveSection('production');
        } else {
          setActiveSection(productionDone && !qcDone ? 'qc' : 'production');
        }
        if (productionDone && qcDone) {
          if (isAdmin) {
            setSubmitMessage(`Entry #${saved.RejectionEntryId ?? '?'} is complete — Admin edit access enabled.`);
          } else {
            setSubmitMessage(`Entry #${saved.RejectionEntryId ?? '?'} is fully complete — all inputs are locked.`);
          }
        } else if (productionDone) {
          if (isProd) {
            setSubmitMessage(`Production complete (Entry #${saved.RejectionEntryId ?? '?'}) — Production is locked and view-only.`);
          } else if (isQC) {
            setSubmitMessage(`Production complete (Entry #${saved.RejectionEntryId ?? '?'}). Complete and save the QC tab.`);
          } else {
            setSubmitMessage(`Production complete (Entry #${saved.RejectionEntryId ?? '?'}). Now complete the QC tab.`);
          }
        } else {
          if (!isAdmin && !isProd && !isQC) {
            setSubmitMessage(`Loaded RejectionEntry #${saved.RejectionEntryId ?? '?'} (${scanned.partNo} | ${scanned.serialNo}) — View only access.`);
          } else if (isQC) {
            setSubmitMessage(`Loaded RejectionEntry #${saved.RejectionEntryId ?? '?'} (${scanned.partNo} | ${scanned.serialNo}). Production is pending.`);
          } else {
            setSubmitMessage(`Loaded existing RejectionEntry #${saved.RejectionEntryId ?? '?'} (${scanned.partNo} | ${scanned.serialNo}). Review and save if needed.`);
          }
        }
      } catch (reloadError) {
        console.log('[RejectionEntry] no existing RejectionEntry:', scanned.transId);
        if (!isAdmin && !isProd && !isQC) {
          setSubmitMessage('View-only access for current user role.');
        }
      }
    } finally {
      setSavedEntryLoading(false);
    }
  }, [loadPartDetails, fetchSavedRejection, isAdmin, isProd, isQC]);

  useEffect(() => {
    if (initialPart?.partNo && initialPart?.serialNo) {
      loadPart(initialPart);
    }
  }, [initialPart?.transId, initialPart?.partNo, initialPart?.serialNo]);

  const onBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setScanError('');
    const scanned = getQrPart(data);
    if (!scanned) {
      setScanError('Invalid QR format. It must be PartNo|SerialNo.');
      setTimeout(() => {
        scanLock.current = false;
      }, 1800);
      return;
    }
    setCameraActive(false);
    setTorch(false);
    loadPart(scanned);
  }, [loadPart]);

  const retryOptions = useCallback(async (type: string) => {
    setOptionErrors((current) => ({ ...current, [type]: '' }));
    setOptionLoading((current) => ({ ...current, [type]: true }));
    try {
      const isDependent = productOptionTypes.includes(type);
      const bodyPayload = isDependent && part?.productId
        ? { type, productId: part.productId }
        : { type };
      const response = await fetch(getOptionsApiUrl(type), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(bodyPayload),
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
    } finally {
      setOptionLoading((current) => ({ ...current, [type]: false }));
    }
  }, [part?.productId]);

  const handleScreenRefresh = useCallback(async () => {
    if (isScanning) return;
    const optionListToFetch = part?.productId ? optionTypes : independentOptionTypes;
    await Promise.all([
      verifyLocationForScreen('/RejectionEntry').catch(() => null),
      part ? loadPart(part) : Promise.resolve(),
      Promise.all(optionListToFetch.map((type) => retryOptions(type))),
    ]);
  }, [isScanning, part, loadPart, retryOptions]);

  const setField = (key: FormKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetCurrentSection = () => {
    if (!isCurrentSectionEditable) return;
    setForm((current) => {
      const next = { ...current };
      sectionFields.forEach((field) => {
        if (field.key === 'leakCode' && part) {
          next[field.key] = `${part.partNo}|${part.serialNo}`;
        } else if (field.key === 'qty') {
          next[field.key] = '1';
        } else if (initialSavedForm) {
          next[field.key] = initialSavedForm[field.key] ?? '';
        } else {
          next[field.key] = '';
        }
      });
      return next;
    });
    setCompletedSections((current) => ({
      ...current,
      [activeSection]: initialSavedForm ? initialCompletedSections[activeSection] : false,
    }));
    setSelectedTemplateTransId('');
    setSubmitMessage(
      initialSavedForm
        ? 'Reset to the original rejection values.'
        : '',
    );
  };

  const applyTemplateTransId = useCallback(async (selectedTransId: string) => {
    if (!part || !selectedTransId || formLocked) return;
    setApplyingTemplate(true);
    setTemplateError('');
    try {
      const record = await fetchSavedRejection(selectedTransId);
      const allowedKeys = new Set<FormKey>();
      if (canEditSection('production')) {
        productionFields.forEach((field) => {
          if (field.key !== 'leakCode' && field.key !== 'qty') allowedKeys.add(field.key);
        });
      }
      if (canEditSection('qc')) {
        qcFields.forEach((field) => {
          if (field.key !== 'leakCode' && field.key !== 'qty') allowedKeys.add(field.key);
        });
      }
      setForm((current) => {
        const next = { ...current };
        for (const [column, key] of Object.entries(rejectionColumnToFormKey)) {
          if (!allowedKeys.has(key)) continue;
          next[key] = rejectionValueToForm(record[column]);
        }
        next.leakCode = `${part.partNo}|${part.serialNo}`;
        next.qty = '1';
        return next;
      });
      setSelectedTemplateTransId(selectedTransId);
      setSubmitMessage(`Loaded template data from ${selectedTransId} successfully. Review before saving.`);
    } catch (error) {
      console.error('Unable to load template rejection entry:', error);
      setTemplateError(error instanceof Error ? error.message : 'Could not load template entry data.');
    } finally {
      setApplyingTemplate(false);
    }
  }, [part, formLocked, fetchSavedRejection, canEditSection]);

  const startScan = async () => {
    setScanError('');
    scanLock.current = false;
    setZoom(0);
    setTorch(false);
    if (permission?.granted) {
      setCameraActive(true);
      return;
    }
    try {
      const result = await requestPermission();
      if (result.granted) {
        setCameraActive(true);
      } else if (!result.canAskAgain) {
        setScanError('Camera permission is disabled. Enable it in device settings to scan a part.');
      } else {
        setScanError('Camera permission is needed to scan a part.');
      }
    } catch (error) {
      console.error('Unable to request camera permission:', error);
      setScanError('Camera permission could not be requested. Check app permissions and try again.');
    }
  };

  const pickAndScanImage = async () => {
    setScanError('');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setScanError('Gallery access is needed to upload a QR code image.');
        return;
      }
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }
      const imageUri = pickerResult.assets[0].uri;
      const scannedCodes = await scanFromURLAsync(imageUri, ['qr', 'datamatrix', 'code128', 'code39', 'pdf417']);
      if (!scannedCodes || scannedCodes.length === 0) {
        setScanError('No QR code detected in the selected image. Please try another image or scan using camera.');
        return;
      }
      const matched = scannedCodes.find((item) => getQrPart(item.data)) || scannedCodes[0];
      scanLock.current = false;
      onBarcodeScanned({ data: matched.data });
    } catch (error) {
      console.error('Error scanning QR from image:', error);
      setScanError('Failed to read QR code from image. Please try again.');
    }
  };

  const resetScan = () => {
    scanLock.current = false;
    setPart(null);
    setDetails(null);
    setProjectName('');
    setTemplateOptions([]);
    setTemplateError('');
    setTemplateLoading(false);
    setApplyingTemplate(false);
    setSelectedTemplateTransId('');
    setInitialSavedForm(null);
    setInitialCompletedSections({ production: false, qc: false });
    loadedTemplateProjectRef.current = '';
    setDetailsError('');
    setScanError('');
    setShowDetails(false);
    setForm(initialForm);
    setSubmitMessage('');
    setActiveSection(isQC ? 'qc' : 'production');
    setCompletedSections({ production: false, qc: false });
    setCameraActive(false);
    setOptionLists((current) => ({
      ...current,
      employees: [],
      dimensions: [],
    }));
  };

  const saveSection = async (section: EntrySection) => {
    if (!part) return;
    if (!canEditSection(section)) {
      setSubmitMessage(`You have view-only access to the ${section === 'production' ? 'Production' : 'QC'} tab.`);
      return;
    }
    if (!part.productId) {
      setSubmitMessage('Product ID is missing. Check the Product Matrix lookup before saving.');
      return;
    }
    if (!isSectionFormComplete(section, form, part)) {
      setSubmitMessage(`Complete all ${section === 'production' ? 'Production' : 'QC'} mandatory fields before saving.`);
      return;
    }
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
      const formPayload = {
        ...form,
        leakCode: `${part.partNo}|${part.serialNo}`,
        qty: '1',
      };
      const xmlPayload = createRejectionXml(part, formPayload, `${username}|${employeeId}`);
      const response = await fetch(REJECTION_SUBMIT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8', Accept: 'application/json' },
        body: xmlPayload,
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
          : `Save failed with status ${response.status}.`;
        throw new Error(message);
      }
      setCompletedSections((current) => ({ ...current, [section]: true }));
      if (isAdmin && section === 'production') {
        setActiveSection('qc');
      }

      if (section === 'production') {
        const savedTransId = part.transId;
        if (!savedTransId) {
          setSubmitMessage('Production saved, but no TransId is available for the refetch.');
          return;
        }
        try {
          const record = await fetchSavedRejection(savedTransId);
          const savedEntryId = record.RejectionEntryId;
          const updatedBaseline: Record<FormKey, string> = {
            ...initialForm,
            rejectedOn: '',
            leakCode: `${part.partNo}|${part.serialNo}`,
            qty: '1',
          };
          for (const [column, key] of Object.entries(rejectionColumnToFormKey)) {
            if (record[column] === undefined || record[column] === null) continue;
            const value = rejectionValueToForm(record[column]);
            if (value.trim()) updatedBaseline[key] = value;
          }
          setInitialSavedForm(updatedBaseline);
          setInitialCompletedSections((current) => ({ ...current, production: true }));
          setSelectedTemplateTransId('');
          setForm((current) => {
            const next = { ...current };
            for (const [column, key] of Object.entries(rejectionColumnToFormKey)) {
              if (record[column] === undefined || record[column] === null) continue;
              const value = rejectionValueToForm(record[column]);
              if (value.trim()) next[key] = value;
            }
            return next;
          });
          if (isProd) {
            setSubmitMessage(`Production saved${savedEntryId ? ` (Entry #${savedEntryId})` : ''} — values refreshed. Production is locked and view-only.`);
          } else if (isAdmin) {
            setSubmitMessage(`Production saved${savedEntryId ? ` (Entry #${savedEntryId})` : ''} — values refreshed. Continue with QC.`);
          } else {
            setSubmitMessage(`Production saved${savedEntryId ? ` (Entry #${savedEntryId})` : ''} — values refreshed from the RejectionEntry table. Now complete the QC tab.`);
          }
        } catch (refetchError) {
          console.error('Unable to refresh saved rejection entry:', refetchError);
          setSubmitMessage(`Production saved, but values could not be refreshed (${refetchError instanceof Error ? refetchError.message : 'unknown error'}).`);
        }
        onSaved?.();
        return;
      }

      setInitialSavedForm((current) => {
        const next: Record<FormKey, string> = {
          ...(current || {
            ...initialForm,
            rejectedOn: '',
            leakCode: `${part.partNo}|${part.serialNo}`,
            qty: '1',
          }),
        };
        qcFields.forEach((field) => {
          next[field.key] = formPayload[field.key] ?? '';
        });
        next.leakCode = `${part.partNo}|${part.serialNo}`;
        next.qty = '1';
        return next;
      });
      setInitialCompletedSections((current) => ({ ...current, qc: true }));
      setSelectedTemplateTransId('');

      if (isQC) {
        setSubmitMessage('QC saved successfully. QC is locked and view-only.');
      } else {
        setSubmitMessage('QC saved successfully.');
      }
      onSaved?.();
    } catch (error) {
      console.error(`Unable to save rejection ${section} section:`, error);
      setSubmitMessage(error instanceof Error ? error.message : `Unable to save the ${section} section.`);
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

  const renderField = (field: FieldDefinition) => {
    const isAlwaysDisabled = field.key === 'leakCode' || field.key === 'qty';
    const value = field.key === 'qty'
      ? '1'
      : isAlwaysDisabled && part
      ? `${part.partNo}|${part.serialNo}`
      : form[field.key];
    const isLoading = !!(field.optionType && optionLoading[field.optionType]);
    const fieldDisabled = isAlwaysDisabled || formLocked || isLoading;
    const fieldStyle = [
      styles.fieldControl,
      { borderColor: colors.border, backgroundColor: colors.surfaceSolid },
      fieldDisabled && !isLoading && styles.disabledField,
    ];

    return (
      <View
        key={field.key}
        onLayout={(e) => {
          fieldOffsets.current[field.key] = e.nativeEvent.layout.y;
        }}
        style={[styles.field, { width: inputWidth as `${number}%` }]}
      >
        <Text style={[styles.fieldLabel, { color: colors.text }]}>{field.label}</Text>
        {field.kind === 'select' ? (
          <Pressable
            accessibilityRole="button"
            disabled={fieldDisabled}
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
              {isLoading
                ? 'Loading options...'
                : value || (part && (field.optionType === 'employees' || field.optionType === 'dimensions') && !optionLists[field.optionType || '']?.length
                  ? 'No options for this partno'
                  : field.placeholder)}
            </Text>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : !fieldDisabled && optionErrors[field.optionType || ''] ? (
              <Ionicons name="refresh-outline" size={17} color={colors.danger} />
            ) : (
              <Ionicons name="chevron-down" size={17} color={colors.muted} />
            )}
          </Pressable>
        ) : field.kind === 'date' ? (
          <>
            <Pressable disabled={fieldDisabled} onPress={() => setActiveDate(field.key)} style={({ pressed }) => [fieldStyle, styles.selectControl, pressed && styles.pressed]}>
              <Ionicons name="calendar-outline" size={17} color={colors.muted} />
              <Text style={[styles.controlText, { color: value ? colors.text : colors.muted }]}>
                {value || 'Pick a date'}
              </Text>
            </Pressable>
          </>
        ) : (
          <TextInput
            value={value}
            onChangeText={(text) => {
              if (field.key !== 'leakCode' && field.key !== 'qty') setField(field.key, text);
            }}
            onFocus={() => {
              lastFocusedField.current = field.key;
              setTimeout(() => {
                scrollToField(field.key);
              }, 60);
            }}
            onBlur={() => {
              if (lastFocusedField.current === field.key) {
                lastFocusedField.current = null;
              }
            }}
            editable={!fieldDisabled}
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
        {field.kind === 'select' && !fieldDisabled && optionErrors[field.optionType || ''] ? (
          <Text style={[styles.fieldError, { color: colors.danger }]}>{optionErrors[field.optionType || '']}</Text>
        ) : null}
      </View>
    );
  };

  const availableTemplateOptions = useMemo(() => {
    const currentTransId = part?.transId?.trim().toLowerCase() || '';
    if (!currentTransId) return templateOptions;
    return templateOptions.filter((option) => option.value.trim().toLowerCase() !== currentTransId);
  }, [templateOptions, part?.transId]);

  const selectedTemplateParts = useMemo(
    () => (selectedTemplateTransId ? parseTransIdParts(selectedTemplateTransId) : null),
    [selectedTemplateTransId],
  );

  const currentSelect = activeSelect && activeSelect !== 'templateTransId'
    ? fields.find((field) => field.key === activeSelect)
    : undefined;
  const currentOptions = activeSelect === 'templateTransId'
    ? availableTemplateOptions
    : currentSelect?.optionType
    ? optionLists[currentSelect.optionType] || []
    : [];
  const filteredOptions = useMemo(() => {
    const query = optionSearch.trim().toLocaleLowerCase();
    if (!query) return currentOptions;
    if (activeSelect === 'templateTransId') {
      const queryNorm = normalizeTemplateSearchText(optionSearch);
      const queryTokens = queryNorm.split(/[\s|_]+/).filter(Boolean);
      return currentOptions
        .map((option, index) => ({
          option,
          index,
          rank: getTemplateOptionRank(option, queryNorm, queryTokens),
        }))
        .filter((entry) => entry.rank >= 0)
        .sort((left, right) => left.rank - right.rank || left.index - right.index)
        .map((entry) => entry.option);
    }
    return currentOptions.filter((option) => option.label.toLocaleLowerCase().includes(query));
  }, [currentOptions, optionSearch, activeSelect]);

  if (isScanning) {
    return (
      <View
        style={[
          styles.inScreenCameraWrapper,
          { paddingTop: insets.top, backgroundColor: '#000' },
        ]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          zoom={zoom}
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix', 'code128', 'code39', 'pdf417'] }}
          onBarcodeScanned={onBarcodeScanned}
        />

        <View style={[styles.inScreenCameraHeader, { paddingTop: Math.max(insets.top, 14) + 4 }]}>
          <Pressable
            onPress={() => {
              setCameraActive(false);
              setTorch(false);
              setScanError('');
            }}
            style={styles.inScreenHeaderBtn}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>

          <View style={styles.inScreenHeaderCenter}>
            <Text style={styles.inScreenHeaderTitle}>Scan Part QR Code</Text>
            <Text style={styles.inScreenHeaderSubtitle}>Align QR code inside the frame</Text>
          </View>

          <Pressable
            onPress={() => setTorch((prev) => !prev)}
            style={[styles.inScreenHeaderBtn, torch && styles.inScreenHeaderBtnActive]}
            accessibilityRole="button"
            accessibilityLabel="Toggle flashlight"
          >
            <Ionicons name={torch ? 'flash' : 'flash-off'} size={20} color={torch ? '#f59e0b' : '#fff'} />
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.inScreenReticleWrapper}>
          <View style={styles.inScreenReticle}>
            <View style={[styles.inScreenCorner, styles.cornerTL]} />
            <View style={[styles.inScreenCorner, styles.cornerTR]} />
            <View style={[styles.inScreenCorner, styles.cornerBL]} />
            <View style={[styles.inScreenCorner, styles.cornerBR]} />
          </View>
        </View>

        <View style={styles.cameraBottomOverlay}>
          {scanError ? (
            <View style={styles.cameraErrorBadge}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.cameraErrorText}>{scanError}</Text>
            </View>
          ) : null}

          <View style={styles.horizontalZoomBar}>
            <View style={styles.zoomPresetRowHorizontal}>
              {[
                { label: '1x', val: 0 },
                { label: '2x', val: 0.25 },
                { label: '5x', val: 0.6 },
                { label: 'MAX', val: 1.0 },
              ].map((p) => {
                const isActive = Math.abs(zoom - p.val) < 0.08;
                return (
                  <Pressable
                    key={p.label}
                    onPress={() => setZoom(p.val)}
                    style={[styles.zoomPresetBadgeHorizontal, isActive && styles.zoomPresetBadgeActiveHorizontal]}
                  >
                    <Text style={[styles.zoomPresetTextHorizontal, isActive && styles.zoomPresetTextActiveHorizontal]}>{p.label}</Text>
                  </Pressable>
                );
              })}
              <View style={styles.zoomValueBadgeHorizontal}>
                <Text style={styles.zoomValueTextHorizontal}>
                  {zoom >= 0.98 ? 'MAX' : `${(1 + zoom * 7).toFixed(1)}x`}
                </Text>
              </View>
            </View>

            <View style={styles.horizontalSliderRow}>
              <Pressable
                onPress={() => stepZoom(-0.1)}
                style={styles.zoomStepBtnHorizontal}
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
              >
                <Ionicons name="remove" size={18} color="#fff" />
              </Pressable>

              <View
                style={styles.horizontalSliderTouchArea}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={handleHorizontalSliderGrant}
                onResponderMove={handleHorizontalSliderMove}
              >
                <View style={styles.horizontalSliderTrack}>
                  <View style={[styles.horizontalSliderFill, { width: `${Math.round(zoom * 100)}%` }]} />
                  <View style={[styles.horizontalSliderThumb, { left: Math.round(zoom * 162) }]} />
                </View>
              </View>

              <Pressable
                onPress={() => stepZoom(0.1)}
                style={styles.zoomStepBtnHorizontal}
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
              >
                <Ionicons name="add" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => void pickAndScanImage()}
            style={({ pressed }) => [styles.inScreenGalleryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Upload QR code from photo gallery"
          >
            <Ionicons name="images-outline" size={18} color="#fff" />
            <Text style={styles.inScreenGalleryText}>Upload QR from Gallery</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <AppScreen
      scrollRef={scrollViewRef}
      onRefresh={handleScreenRefresh}
      contentStyle={keyboardHeight > 0 ? { paddingBottom: keyboardHeight + 80 } : undefined}
      title="Rejection Entry"
      subtitle="Review the scanned part and complete the rejection details."
    >
      <View style={[styles.scanCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
          <View style={styles.sectionHeading}>
            <View style={[styles.headingIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name={part ? 'cube-outline' : 'qr-code-outline'} size={21} color={colors.accent} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{part ? 'Part Scanned' : 'Scan Part'}</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                {part ? 'Review the scanned part and complete the rejection details.' : 'Start by scanning the QR code on the part.'}
              </Text>
            </View>
            {part ? (
              onClose ? (
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close form"
                  style={styles.headingIconButton}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.accent} />
                </Pressable>
              ) : !hideScanner ? (
                <Pressable
                  onPress={resetScan}
                  accessibilityRole="button"
                  accessibilityLabel="Return to scan part"
                  style={styles.headingIconButton}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.accent} />
                </Pressable>
              ) : null
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
                <Text style={[styles.scannedMeta, { color: colors.muted }]}>Serial No · {part.serialNo}</Text>
              </View>
              {lookupLoading ? <ActivityIndicator color={colors.accent} /> : null}
            </View>
          ) : !hideScanner ? (
            <View style={[styles.scanLanding, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.scanIllustration, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="qr-code-outline" size={34} color={colors.accent} />
              </View>
              <View style={styles.scanActionsRow}>
                <Pressable
                  onPress={() => void startScan()}
                  style={({ pressed }) => [styles.startScan, { backgroundColor: colors.accent }, pressed && styles.pressed]}
                >
                  <Ionicons name="scan-outline" size={20} color="#fff" />
                  <Text style={styles.startScanText}>Scan Part</Text>
                </Pressable>
                <Pressable
                  onPress={() => void pickAndScanImage()}
                  style={({ pressed }) => [
                    styles.uploadScan,
                    { borderColor: colors.accent, backgroundColor: colors.surfaceSolid },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="images-outline" size={20} color={colors.accent} />
                  <Text style={[styles.uploadScanText, { color: colors.accent }]}>Upload QR</Text>
                </Pressable>
              </View>
              <View style={styles.scanInstructions}>
                {[
                  { icon: 'scan-outline' as const, text: 'Tap Scan Part or Upload QR to load the part QR code.' },
                  { icon: 'clipboard-outline' as const, text: 'Check the part details, then fill in the rejection form.' },
                  { icon: 'cloud-upload-outline' as const, text: 'Save Production, then complete and save QC.' },
                ].map((instruction, index) => (
                  <View key={instruction.text} style={styles.scanInstruction}>
                    <View style={[styles.instructionIcon, { backgroundColor: colors.surfaceSolid }]}>
                      <Ionicons name={instruction.icon} size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.instructionText, { color: colors.muted }]}>
                      <Text style={[styles.instructionNumber, { color: colors.text }]}>{index + 1}. </Text>
                      {instruction.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

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
            <>
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
              {!formLocked ? (
                <View style={[styles.templateSelectContainer, { borderTopColor: colors.border }]}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Copy Data from Previous Trans ID</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={templateLoading || applyingTemplate || submitting || lookupLoading}
                    onPress={() => {
                      if (templateError && projectName) {
                        void fetchProjectTransIds(projectName);
                        return;
                      }
                      setActiveSelect('templateTransId');
                    }}
                    style={({ pressed }) => [
                      styles.fieldControl,
                      styles.selectControl,
                      selectedTemplateParts && !templateLoading && !applyingTemplate && styles.templateSelectedControl,
                      { borderColor: selectedTemplateParts ? colors.accent : colors.border, backgroundColor: colors.surfaceAlt },
                      (templateLoading || applyingTemplate || submitting || lookupLoading) && styles.disabledField,
                      pressed && styles.pressed,
                    ]}
                  >
                    {templateLoading || applyingTemplate || !selectedTemplateParts ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.controlText,
                          { color: colors.muted },
                        ]}
                      >
                        {templateLoading
                          ? 'Loading options...'
                          : applyingTemplate
                          ? 'Copying entry data...'
                          : !templateError && projectName && loadedTemplateProjectRef.current === projectName && !availableTemplateOptions.length
                          ? 'No partnos from this project in history'
                          : 'Select Part No / Serial No'}
                      </Text>
                    ) : (
                      <View style={styles.templateSelectedCopy}>
                        <Text numberOfLines={1} style={[styles.templateSelectedTitle, { color: colors.text }]}>
                          {selectedTemplateParts.partNo}
                        </Text>
                        {selectedTemplateParts.serialNo ? (
                          <Text numberOfLines={1} style={[styles.templateSelectedSubtitle, { color: colors.muted }]}>
                            Serial No: {selectedTemplateParts.serialNo}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    {templateLoading || applyingTemplate ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : templateError ? (
                      <Ionicons name="refresh-outline" size={17} color={colors.danger} />
                    ) : (
                      <Ionicons name="chevron-down" size={17} color={colors.muted} />
                    )}
                  </Pressable>
                  {templateError ? (
                    <Text style={[styles.fieldError, { color: colors.danger }]}>{templateError}</Text>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </View>

      {part ? (
        <View
          onLayout={(e) => {
            formCardY.current = e.nativeEvent.layout.y;
          }}
          style={[styles.formCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
        >
          <View style={styles.formHeading}>
            <View style={[styles.headingIcon, { backgroundColor: `${colors.danger}18` }]}>
              <Ionicons name="clipboard-outline" size={21} color={colors.danger} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Rejection Details</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>Save each completed tab; both tabs lock after Production and QC are saved.</Text>
            </View>
          </View>
          <View style={[styles.entryTabs, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            {([
              { key: 'production', label: 'Production' },
              { key: 'qc', label: 'QC' },
            ] as const).map((tab) => {
              const selected = activeSection === tab.key;
              const complete = completedSections[tab.key];
              const tabEditable = canEditSection(tab.key);
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityLabel={`${tab.label}, ${complete ? 'completed' : 'pending'}`}
                  accessibilityState={{ selected, disabled: allSectionsComplete }}
                  onPress={() => {
                    setActiveSection(tab.key);
                  }}
                  style={({ pressed }) => [
                    styles.entryTab,
                    selected && { backgroundColor: colors.accent },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.entryTabLabel, { color: selected ? '#fff' : colors.text }]}>{tab.label}</Text>
                  {complete ? (
                    <Ionicons name="checkmark-circle" size={17} color={selected ? '#fff' : colors.accent} />
                  ) : !tabEditable ? (
                    <Ionicons name="lock-closed-outline" size={15} color={selected ? '#fff' : colors.muted} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.fieldsGrid}>{sectionFields.map(renderField)}</View>
          <View style={[styles.formActions, { flexDirection: actionsInRow ? 'row' : 'column' }]}>
            <Pressable
              onPress={resetCurrentSection}
              disabled={formLocked}
              style={({ pressed }) => [
                styles.resetButton,
                actionsInRow ? styles.actionButtonHalf : styles.actionButtonFull,
                { borderColor: colors.border },
                pressed && styles.pressed,
                formLocked && styles.disabled,
              ]}
            >
              <Ionicons name="refresh-outline" size={17} color={colors.muted} />
              <Text style={[styles.resetButtonText, { color: colors.text }]}>Reset {activeSection === 'production' ? 'Production' : 'QC'}</Text>
            </Pressable>
            <Pressable
              onPress={() => void saveSection(activeSection)}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                actionsInRow ? styles.actionButtonHalf : styles.actionButtonFull,
                { backgroundColor: !canSubmit ? colors.muted : colors.accent },
                pressed && canSubmit && styles.pressed,
                !canSubmit && styles.disabled,
              ]}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={styles.submitButtonText}>
                  {formLocked
                    ? 'View Only'
                    : sectionComplete
                    ? (isAdmin ? `Update ${activeSection === 'production' ? 'Production' : 'QC'}` : `${activeSection === 'production' ? 'Production' : 'QC'} Saved`)
                    : `Save ${activeSection === 'production' ? 'Production' : 'QC'}`}
                </Text>
              )}
              {!submitting && !formLocked ? (
                <Ionicons
                  name={sectionComplete && !isAdmin ? 'checkmark-circle-outline' : 'arrow-forward'}
                  size={17}
                  color="#fff"
                />
              ) : null}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setActiveSelect(null);
              setOptionSearch('');
            }}
          />
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.optionSheet, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {activeSelect === 'templateTransId'
                ? 'Copy from Previous Trans ID'
                : currentSelect?.label || 'Select an option'}
            </Text>
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                value={optionSearch}
                onChangeText={setOptionSearch}
                placeholder={activeSelect === 'templateTransId' ? 'Search Part No, Serial No or Trans ID' : 'Search options'}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={activeSelect === 'templateTransId' ? 'Search Part No, Serial No or Trans ID' : `Search ${currentSelect?.label || 'options'}`}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {optionSearch ? (
                <Pressable onPress={() => setOptionSearch('')} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
              {(activeSelect === 'templateTransId' && templateLoading) || (currentSelect?.optionType && optionLoading[currentSelect.optionType]) ? (
                <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.noOptions, { color: colors.muted, paddingTop: 8 }]}>Loading options...</Text>
                </View>
              ) : (
                <>
                  {filteredOptions.map((option) => {
                    if (activeSelect === 'templateTransId') {
                      const isSelected = selectedTemplateTransId === option.value;
                      const { partNo: optionPartNo, serialNo: optionSerialNo } = parseTransIdParts(option.label);
                      return (
                        <Pressable
                          key={`${option.value}:${option.label}`}
                          onPress={() => {
                            setActiveSelect(null);
                            setOptionSearch('');
                            void applyTemplateTransId(option.value);
                          }}
                          style={({ pressed }) => [
                            styles.templateOptionCard,
                            {
                              backgroundColor: isSelected ? colors.accentSoft : colors.surfaceAlt,
                              borderColor: isSelected ? colors.accent : colors.border,
                            },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <View
                            style={[
                              styles.templateOptionBadge,
                              { backgroundColor: isSelected ? colors.accent : colors.accentSoft },
                            ]}
                          >
                            <Ionicons
                              name="document-text-outline"
                              size={16}
                              color={isSelected ? '#ffffff' : colors.accent}
                            />
                          </View>
                          <View style={styles.templateOptionCopy}>
                            <Text numberOfLines={1} style={[styles.templateOptionTitle, { color: colors.text }]}>
                              {optionPartNo}
                            </Text>
                            {optionSerialNo ? (
                              <Text numberOfLines={1} style={[styles.templateOptionSubtitle, { color: colors.muted }]}>
                                Serial No: {optionSerialNo}
                              </Text>
                            ) : null}
                          </View>
                          {isSelected ? (
                            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                          ) : (
                            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                          )}
                        </Pressable>
                      );
                    }
                    return (
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
                        {!!activeSelect && form[activeSelect] === option.label ? (
                          <Ionicons name="checkmark" size={19} color={colors.accent} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {!currentOptions.length ? (
                    <Text style={[styles.noOptions, { color: colors.muted }]}>
                      {activeSelect === 'templateTransId'
                        ? templateError || 'No partnos from this project in history.'
                        : currentSelect?.optionType && optionErrors[currentSelect.optionType]
                        ? optionErrors[currentSelect.optionType]
                        : currentSelect?.optionType === 'employees' || currentSelect?.optionType === 'dimensions'
                        ? 'No options for this partno'
                        : 'No options available.'}
                    </Text>
                  ) : null}
                  {!!currentOptions.length && !filteredOptions.length ? (
                    <Text style={[styles.noOptions, { color: colors.muted }]}>No matching options.</Text>
                  ) : null}
                </>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
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
  headingIconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  scanCard: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  headingIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  headingCopy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionSubtitle: { fontSize: 11, lineHeight: 16 },
  inScreenCameraWrapper: { flex: 1, width: '100%', backgroundColor: '#000', position: 'relative' },
  inScreenCameraHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 20 },
  inScreenHeaderBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  inScreenHeaderBtnActive: { backgroundColor: 'rgba(245,158,11,0.3)', borderWidth: 1, borderColor: '#f59e0b' },
  inScreenHeaderCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  inScreenHeaderTitle: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  inScreenHeaderSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2, textAlign: 'center' },
  inScreenReticleWrapper: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  inScreenReticle: { width: 220, height: 220, position: 'relative' },
  inScreenCorner: { position: 'absolute', width: 34, height: 34, borderColor: '#22c55e', borderWidth: 4 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 14 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 14 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 14 },
  cameraBottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, zIndex: 20, gap: 16 },
  cameraErrorBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.22)', borderWidth: 1, borderColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, maxWidth: '92%' },
  cameraErrorText: { color: '#fca5a5', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  horizontalZoomBar: { width: '100%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', gap: 8 },
  zoomPresetRowHorizontal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  zoomPresetBadgeHorizontal: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)', minWidth: 32, alignItems: 'center' },
  zoomPresetBadgeActiveHorizontal: { backgroundColor: '#22c55e' },
  zoomPresetTextHorizontal: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  zoomPresetTextActiveHorizontal: { color: '#000000' },
  zoomValueBadgeHorizontal: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.22)', marginLeft: 6 },
  zoomValueTextHorizontal: { color: '#22c55e', fontSize: 11, fontWeight: '800' },
  horizontalSliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  zoomStepBtnHorizontal: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  horizontalSliderTouchArea: { width: 180, height: 32, alignItems: 'center', justifyContent: 'center' },
  horizontalSliderTrack: { width: 180, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)', position: 'relative', justifyContent: 'center' },
  horizontalSliderFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 4 },
  horizontalSliderThumb: { position: 'absolute', top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#22c55e', elevation: 3 },
  inScreenGalleryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  inScreenGalleryText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  scanLanding: { padding: 16, borderRadius: 18 },
  scanIllustration: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 24, alignSelf: 'center', marginBottom: 16 },
  scanInstructions: { gap: 13, marginTop: 19 },
  scanInstruction: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  instructionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  instructionText: { flex: 1, fontSize: 11, lineHeight: 16 },
  instructionNumber: { fontWeight: '700' },
  scanActionsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  startScan: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14 },
  startScanText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  uploadScan: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 14 },
  uploadScanText: { fontSize: 13, fontWeight: '700' },
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
  templateSelectContainer: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  templateSelectedControl: { paddingVertical: 8 },
  templateSelectedCopy: { flex: 1, gap: 2 },
  templateSelectedTitle: { fontSize: 12, fontWeight: '700' },
  templateSelectedSubtitle: { fontSize: 10, fontWeight: '600' },
  templateOptionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderRadius: 14, marginBottom: 8 },
  templateOptionBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  templateOptionCopy: { flex: 1, minWidth: 0, gap: 3 },
  templateOptionTitle: { fontSize: 13, fontWeight: '700' },
  templateOptionSubtitle: { fontSize: 11, fontWeight: '600' },
  formCard: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 22 },
  formHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  entryTabs: { flexDirection: 'row', gap: 6, padding: 5, borderWidth: 1, borderRadius: 14, marginBottom: 18 },
  entryTab: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10 },
  entryTabLabel: { fontSize: 12, fontWeight: '700' },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 15 },
  field: { minWidth: 0 },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: 7 },
  fieldControl: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 },
  disabledField: { opacity: 0.7 },
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

