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
import { useFocusEffect } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';

const OPTIONS_API_URL = 'https://gtims-quality-control.vercel.app/api/casting-rejection/get-options';
const DIMENSIONS_OPTIONS_API_URL = 'https://gtims-quality-control.vercel.app/api/MG_Daily_Rejection/options/get-options';
const BACKEND_BASE_URL = 'https://gtiappsbackend.vercel.app';
const PART_DETAILS_API_URL = `${BACKEND_BASE_URL}/api/product-matrix/part-details`;
const REJECTION_SUBMIT_API_URL = `${BACKEND_BASE_URL}/api/rejection/save`;
const REJECTION_GET_API_URL = `${BACKEND_BASE_URL}/api/rejection/get`;

function getOptionsApiUrl(type: string) {
  return type === 'dimensions' ? DIMENSIONS_OPTIONS_API_URL : OPTIONS_API_URL;
}

type SelectOption = { value: string; label: string };
type FormKey =
  | 'scrapDate' | 'rejectedOn' | 'foundAt' | 'leakCode' | 'shift' | 'shopFloor'
  | 'partName' | 'bhChThIm' | 'op' | 'fixPos' | 'defectType' | 'dimension'
  | 'actual' | 'qty' | 'operator' | 'leader' | 'decision' | 'reason' | 'returnReason'
  | 'targetDate' | 'status' | 'correctiveAction';
type EntrySection = 'production' | 'qc';
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
  { key: 'dimension', label: 'HEX | NO | Nominal', kind: 'select', optionType: 'dimensions', placeholder: 'Select dimension' },
  { key: 'actual', label: 'Actual', kind: 'number', placeholder: 'Enter actual value' },
  { key: 'qty', label: 'QTY', kind: 'number', placeholder: 'Enter quantity' },
  { key: 'operator', label: 'Operator', kind: 'select', optionType: 'employees', placeholder: 'Select operator' },
  { key: 'leader', label: 'Leader', kind: 'select', optionType: 'employees', placeholder: 'Select leader' },
  { key: 'decision', label: 'Scrap Type', kind: 'select', optionType: 'decisions', placeholder: 'Select scrap type' },
  { key: 'reason', label: 'Reason for Rejection', kind: 'multiline', placeholder: 'Describe the reason for rejection...' },
  { key: 'returnReason', label: 'Reason for Return', kind: 'multiline', placeholder: 'Describe the reason for return...' },
  { key: 'targetDate', label: 'Target Date', kind: 'date' },
  { key: 'status', label: 'Status', kind: 'select', optionType: 'entryStatuses', placeholder: 'Select status' },
  { key: 'correctiveAction', label: 'Corrective Action', kind: 'multiline', placeholder: 'Describe the corrective action taken...' },
];

const qcFieldKeys: FormKey[] = ['scrapDate', 'foundAt', 'returnReason', 'correctiveAction', 'targetDate', 'status'];
const productionFields = fields.filter((field) => !qcFieldKeys.includes(field.key));
const qcFields = fields.filter((field) => qcFieldKeys.includes(field.key));

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
  qty: '1',
  operator: '',
  leader: '',
  decision: '',
  reason: '',
  returnReason: '',
  targetDate: '',
  status: '',
  correctiveAction: '',
};

const optionTypes = ['shifts', 'foundAt', 'defectTypes', 'dimensions', 'employees', 'operations', 'decisions'];
const entryStatuses: SelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
];

type ScannedPart = { transId: string; partNo: string; serialNo: string; productId?: string };

function formatDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function getQrPart(data: string): ScannedPart | null {
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
  RejectionReason: 'reason',
  TargetDate: 'targetDate',
  Status: 'status',
  CorrectiveAction: 'correctiveAction',
  ReturnReason: 'returnReason',
};

const productionCompleteColumns: string[] = [
  'RejectedOn', 'LeakCode', 'Shift', 'ShopFloor', 'PartName', 'BhChThIm',
  'OP', 'FixPos', 'DefectType', 'Dimension', 'Actual', 'Qty',
  'OperatorName', 'LeaderName', 'Decision', 'RejectionReason',
];

const qcCompleteColumns: string[] = [
  'ScrapDate', 'FoundAt', 'ReturnReason', 'CorrectiveAction', 'TargetDate', 'Status',
];

function isSectionCompleteFromRecord(record: Record<string, unknown>, columns: string[]): boolean {
  return columns.every((column) => {
    const value = record[column];
    return value !== null && value !== undefined && String(value).trim() !== '';
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
  const [activeSection, setActiveSection] = useState<EntrySection>('production');
  const [completedSections, setCompletedSections] = useState<Record<EntrySection, boolean>>({
    production: false,
    qc: false,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginType, setLoginType] = useState('');
  const scanLock = useRef(false);
  const columns = width >= 1180 ? 4 : width >= 700 ? 2 : 1;
  const inputWidth = columns === 1 ? '100%' : `${100 / columns - 1.5}%`;
  const actionsInRow = width >= 390;
  const allSectionsComplete = completedSections.production && completedSections.qc;
  const sectionFields = activeSection === 'production' ? productionFields : qcFields;
  const sectionComplete = completedSections[activeSection];

  const isAdmin = loginType === 'admin';
  const isProd = loginType === 'prod';
  const isQC = loginType === 'qc';

  const canEditSection = useCallback((section: EntrySection) => {
    if (isAdmin) return true;
    if (allSectionsComplete) return false;
    if (isProd) return section === 'production';
    if (isQC) return section === 'qc';
    return true;
  }, [isAdmin, allSectionsComplete, isProd, isQC]);

  const isCurrentSectionEditable = canEditSection(activeSection);
  const formLocked = !isCurrentSectionEditable;

  useEffect(() => {
    SecureStore.getItemAsync('logintype').then(async (val) => {
      const resolved = val || (await SecureStore.getItemAsync('tl'));
      const type = (resolved || '').trim().toLowerCase();
      setLoginType(type);
      if (type === 'qc') {
        setActiveSection('qc');
      }
    }).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      SecureStore.getItemAsync('logintype').then(async (val) => {
        const resolved = val || (await SecureStore.getItemAsync('tl'));
        if (resolved) setLoginType(resolved.trim().toLowerCase());
      }).catch(() => {});
    }, [])
  );

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    optionTypes.forEach((type) => {
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
      });
    });
    return () => controller.abort();
  }, []));

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
        setDetailsError(`No Product Matrix details were returned for part number ${scanned.partNo}.`);
        return;
      }
      const productId = findDetail(record, ['Product_Id', 'ProductId']);
      if (!/^\d+$/.test(productId)) {
        setDetails(null);
        setDetailsError(`No valid Product ID was returned for part number ${scanned.partNo}.`);
        return;
      }
      setDetails(record);
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
    console.log('[RejectionEntry] rejection GET ->', target);
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
    console.log('[RejectionEntry] rejection GET response:', payload.data);
    return payload.data as Record<string, unknown>;
  }, []);

  const onBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setCameraActive(false);
    setScanError('');
    console.log('[RejectionEntry] raw scan input:', data);
    const scanned = getQrPart(data);
    if (!scanned) {
      setScanError('QR format was not recognized. It must be partNo|serialNo.');
      scanLock.current = false;
      return;
    }
    console.log('[RejectionEntry] scanned part:', scanned);
    setActiveSection(isQC ? 'qc' : 'production');
    setCompletedSections({ production: false, qc: false });
    setSubmitMessage('');
    setForm({ ...initialForm, leakCode: `${scanned.partNo}|${scanned.serialNo}`, qty: '1' }); 
    setPart(scanned);
    void (async () => {
      await loadPartDetails(scanned);
      try {
        const saved = await fetchSavedRejection(scanned.transId);
        console.log('[RejectionEntry] existing RejectionEntry loaded for rescan:', saved);
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
            setSubmitMessage(`Production complete (Entry #${saved.RejectionEntryId ?? '?'}). QC tab is view-only.`);
          } else {
            setSubmitMessage(`Production complete (Entry #${saved.RejectionEntryId ?? '?'}). Now complete the QC tab.`);
          }
        } else {
          setSubmitMessage(`Loaded existing RejectionEntry #${saved.RejectionEntryId ?? '?'} (${scanned.partNo} | ${scanned.serialNo}). Review and save if needed.`);
        }
      } catch (reloadError) {
        console.log('[RejectionEntry] no existing RejectionEntry for rescan:', scanned.transId);
      }
    })();
  }, [loadPartDetails, fetchSavedRejection, isAdmin, isProd, isQC]);

  const retryOptions = useCallback(async (type: string) => {
    setOptionErrors((current) => ({ ...current, [type]: '' }));
    try {
      const response = await fetch(getOptionsApiUrl(type), {
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

  const resetCurrentSection = () => {
    if (!isCurrentSectionEditable) return;
    setForm((current) => {
      const next = { ...current };
      sectionFields.forEach((field) => {
        if (field.key === 'leakCode' && part) {
          next[field.key] = `${part.partNo}|${part.serialNo}`;
        } else if (field.key === 'qty') {
          next[field.key] = '1';
        } else {
          next[field.key] = '';
        }
      });
      return next;
    });
    setCompletedSections((current) => ({ ...current, [activeSection]: false }));
    setSubmitMessage('');
  };

  const startScan = async () => {
    setScanError('');
    scanLock.current = false;
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

  const resetScan = () => {
    scanLock.current = false;
    setPart(null);
    setDetails(null);
    setDetailsError('');
    setScanError('');
    setShowDetails(false);
    setForm(initialForm);
    setSubmitMessage('');
    setActiveSection(isQC ? 'qc' : 'production');
    setCompletedSections({ production: false, qc: false });
    setCameraActive(false);
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
    const requiredFields = section === 'production' ? productionFields : qcFields;
    const missingField = requiredFields.find((field) => !form[field.key].trim());
    if (missingField) {
      setSubmitMessage(`Complete all ${section === 'production' ? 'Production' : 'QC'} fields before saving.`);
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
      console.log('[RejectionEntry] save XML payload:', xmlPayload);
      const response = await fetch(REJECTION_SUBMIT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8', Accept: 'application/json' },
        body: xmlPayload,
      });
      const responseText = await response.text();
      console.log('[RejectionEntry] save response:', responseText);
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
      setActiveSection('qc');

      if (section === 'production') {
        const savedTransId = part.transId;
        if (!savedTransId) {
          setSubmitMessage('Production saved, but no TransId is available for the refetch.');
          return;
        }
        try {
          const record = await fetchSavedRejection(savedTransId);
          const savedEntryId = record.RejectionEntryId;
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
            setSubmitMessage(`Production saved${savedEntryId ? ` (Entry #${savedEntryId})` : ''} — values refreshed. QC tab is view-only for Production.`);
          } else {
            setSubmitMessage(`Production saved${savedEntryId ? ` (Entry #${savedEntryId})` : ''} — values refreshed from the RejectionEntry table. Now complete the QC tab.`);
          }
        } catch (refetchError) {
          console.error('Unable to refresh saved rejection entry:', refetchError);
          setSubmitMessage(`Production saved, but values could not be refreshed (${refetchError instanceof Error ? refetchError.message : 'unknown error'}).`);
        }
        return;
      }

      setSubmitMessage('QC saved successfully.');
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
    const fieldDisabled = isAlwaysDisabled || formLocked;
    const fieldStyle = [
      styles.fieldControl,
      { borderColor: colors.border, backgroundColor: colors.surfaceSolid },
      fieldDisabled && styles.disabledField,
    ];

    return (
      <View key={field.key} style={[styles.field, { width: inputWidth as `${number}%` }]}>
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
              {value || field.placeholder}
            </Text>


            {!fieldDisabled && optionErrors[field.optionType || ''] ? (
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
            <Ionicons name={part ? 'cube-outline' : 'qr-code-outline'} size={21} color={colors.accent} />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{part ? 'Part Scanned' : 'Scan Part'}</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              {part ? 'Review the scanned part and complete the rejection details.' : cameraActive ? 'Point the camera at the part QR code.' : 'Start by scanning the QR code on the part.'}
            </Text>
          </View>
          {part ? (
            <Pressable onPress={resetScan} accessibilityRole="button" accessibilityLabel="Return to scan part">
              <Ionicons name="close-circle-outline" size={22} color={colors.accent} />
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
              <Text style={[styles.scannedMeta, { color: colors.muted }]}>Serial No · {part.serialNo}</Text>
            </View>
            {lookupLoading ? <ActivityIndicator color={colors.accent} /> : null}
          </View>
        ) : cameraActive ? (
          <View style={[styles.cameraFrame, { borderColor: colors.border }]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix', 'code128', 'code39', 'pdf417'] }}
              onBarcodeScanned={onBarcodeScanned}
            />
            <Pressable
              onPress={() => setCameraActive(false)}
              style={styles.cameraCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close scanner"
            >
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
            <View pointerEvents="none" style={styles.scanOverlay}>
              <View style={[styles.scanCorner, styles.scanCornerTopLeft, { borderColor: colors.accent }]} />
              <View style={[styles.scanCorner, styles.scanCornerTopRight, { borderColor: colors.accent }]} />
              <View style={[styles.scanCorner, styles.scanCornerBottomLeft, { borderColor: colors.accent }]} />
              <View style={[styles.scanCorner, styles.scanCornerBottomRight, { borderColor: colors.accent }]} />
            </View>
          </View>
        ) : (
          <View style={[styles.scanLanding, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.scanIllustration, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="qr-code-outline" size={34} color={colors.accent} />
            </View>
            <Pressable onPress={() => void startScan()} style={({ pressed }) => [styles.startScan, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
              <Ionicons name="scan-outline" size={21} color="#fff" />
              <Text style={styles.startScanText}>Scan Part</Text>
            </Pressable>
            <View style={styles.scanInstructions}>
              {[
                { icon: 'scan-outline' as const, text: 'Tap Scan Part and point your camera at the part QR code.' },
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
                    setSubmitMessage('');
                  }}
                  style={({ pressed }) => [
                    styles.entryTab,
                    selected && { backgroundColor: colors.surfaceSolid },
                    pressed && !allSectionsComplete && styles.pressed,
                    allSectionsComplete && styles.disabled,
                  ]}
                >
                  <Ionicons
                    name={tabEditable ? 'create-outline' : 'eye-outline'}
                    size={16}
                    color={tabEditable ? (selected ? colors.accent : colors.muted) : colors.muted}
                  />

                  <Text style={[styles.entryTabLabel, { color: selected ? colors.text : colors.muted }]}>
                    {tab.label}
                  </Text>

                  <Ionicons
                    name={complete ? 'checkmark-circle' : 'ellipse-outline'}
                    size={17}
                    color={complete ? colors.accent : colors.muted}
                  />
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
              disabled={submitting || formLocked || lookupLoading || !part.productId}
              style={({ pressed }) => [
                styles.submitButton,
                actionsInRow ? styles.actionButtonHalf : styles.actionButtonFull,
                { backgroundColor: formLocked ? colors.muted : colors.accent },
                pressed && styles.pressed,
                (submitting || formLocked || lookupLoading || !part.productId) && styles.disabled,
              ]}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={styles.submitButtonText}>
                  {formLocked
                    ? 'View Only'
                    : sectionComplete
                    ? `${activeSection === 'production' ? 'Production' : 'QC'} Saved`
                    : `Save ${activeSection === 'production' ? 'Production' : 'QC'}`}
                </Text>
              )}
              {!submitting && !formLocked ? <Ionicons name={sectionComplete ? 'checkmark-circle-outline' : 'arrow-forward'} size={17} color="#fff" /> : null}
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
  cameraCloseButton: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  scanLanding: { padding: 16, borderRadius: 18 },
  scanIllustration: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 24, alignSelf: 'center', marginBottom: 16 },
  scanInstructions: { gap: 13, marginTop: 19 },
  scanInstruction: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  instructionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  instructionText: { flex: 1, fontSize: 11, lineHeight: 16 },
  instructionNumber: { fontWeight: '700' },
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
