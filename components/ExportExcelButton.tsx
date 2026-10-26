import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx-js-style';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

type ExportExcelButtonProps = {
  records: Record<string, unknown>[];
  startDate: Date;
  endDate: Date;
};

const partDetailsColumns = ['RejectionEntryId', 'TransId', 'PartNo', 'SerialNo', 'ProductId'];

const productionCompleteColumns = [
  'RejectedOn', 'LeakCode', 'Shift', 'ShopFloor', 'PartName', 'BhChThIm',
  'OP', 'FixPos', 'DefectType', 'Dimension', 'Actual', 'Qty',
  'OperatorName', 'LeaderName', 'Decision', 'RejectionReason',
];

const qcCompleteColumns = [
  'ScrapDate', 'FoundAt', 'ReturnReason', 'CorrectiveAction', 'TargetDate', 'Status',
];

const recordInfoColumns = ['CreatedBy', 'CreatedAt'];

const allColumns = [
  ...partDetailsColumns,
  ...productionCompleteColumns,
  ...qcCompleteColumns,
  ...recordInfoColumns,
];

function getRecordValue(record: Record<string, unknown>, key: string): unknown {
  if (record[key] !== undefined) return record[key];
  const lowerKey = key.toLowerCase();
  for (const [k, v] of Object.entries(record)) {
    if (k.toLowerCase() === lowerKey) return v;
  }
  return undefined;
}

function formatCellValue(key: string, value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      if (key === 'CreatedAt') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.toLocaleString();
      }
      return value.split('T')[0];
    }
    return value;
  }
  return String(value);
}

function formatDateForFileName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function ExportExcelButton({ records, startDate, endDate }: ExportExcelButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting || records.length === 0) return;
    try {
      setExporting(true);

      const row0 = new Array(allColumns.length).fill('');
      row0[0] = 'Part Details';
      row0[partDetailsColumns.length] = 'Production';
      row0[partDetailsColumns.length + productionCompleteColumns.length] = 'QC';
      row0[partDetailsColumns.length + productionCompleteColumns.length + qcCompleteColumns.length] = 'Record Info';

      const row1 = allColumns;

      const dataRows = records.map((record) => {
        return allColumns.map((col) => formatCellValue(col, getRecordValue(record, col)));
      });

      const sheetData = [row0, row1, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: partDetailsColumns.length - 1 } },
        { s: { r: 0, c: partDetailsColumns.length }, e: { r: 0, c: partDetailsColumns.length + productionCompleteColumns.length - 1 } },
        { s: { r: 0, c: partDetailsColumns.length + productionCompleteColumns.length }, e: { r: 0, c: partDetailsColumns.length + productionCompleteColumns.length + qcCompleteColumns.length - 1 } },
        { s: { r: 0, c: partDetailsColumns.length + productionCompleteColumns.length + qcCompleteColumns.length }, e: { r: 0, c: allColumns.length - 1 } },
      ];

      ws['!cols'] = allColumns.map((col) => {
        let maxLen = col.length;
        for (const record of records) {
          const val = getRecordValue(record, col);
          if (val != null) {
            const len = String(val).length;
            if (len > maxLen) maxLen = Math.min(len, 40);
          }
        }
        return { wch: Math.max(maxLen + 3, 12) };
      });

      const parentHeaderStyle = {
        fill: { fgColor: { rgb: 'B4C6E7' } },
        font: { bold: true, sz: 11, color: { rgb: '1B365D' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '5B7BB3' } },
          bottom: { style: 'thin', color: { rgb: '5B7BB3' } },
          left: { style: 'thin', color: { rgb: '5B7BB3' } },
          right: { style: 'thin', color: { rgb: '5B7BB3' } },
        },
      };

      const childHeaderStyle = {
        fill: { fgColor: { rgb: 'D9E1F2' } },
        font: { bold: true, sz: 10, color: { rgb: '1B365D' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '8EA9DB' } },
          bottom: { style: 'thin', color: { rgb: '8EA9DB' } },
          left: { style: 'thin', color: { rgb: '8EA9DB' } },
          right: { style: 'thin', color: { rgb: '8EA9DB' } },
        },
      };

      const dataCellStyle = {
        alignment: { vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'D9D9D9' } },
          bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
          left: { style: 'thin', color: { rgb: 'D9D9D9' } },
          right: { style: 'thin', color: { rgb: 'D9D9D9' } },
        },
      };

      for (let r = 0; r < sheetData.length; r++) {
        for (let c = 0; c < allColumns.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellRef]) {
            ws[cellRef] = { t: 's', v: '' };
          }
          if (r === 0) {
            ws[cellRef].s = parentHeaderStyle;
          } else if (r === 1) {
            ws[cellRef].s = childHeaderStyle;
          } else {
            ws[cellRef].s = dataCellStyle;
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rejections');

      const fileName = `Rejection_History_${formatDateForFileName(startDate)}_to_${formatDateForFileName(endDate)}.xlsx`;

      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, fileName);
      } else {
        const base64Data = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (!directory) {
          throw new Error('No storage directory available on device.');
        }
        const fileUri = `${directory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const shareAvailable = await Sharing.isAvailableAsync();
        if (shareAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Rejection History',
            UTI: 'com.microsoft.excel.xlsx',
          });
        } else {
          Alert.alert('Exported', `File saved at ${fileUri}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export Excel.';
      Alert.alert('Export Error', message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Pressable
      onPress={handleExport}
      disabled={exporting || records.length === 0}
      style={({ pressed }) => [
        styles.button,
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Export to Excel"
    >
      {exporting ? (
        <ActivityIndicator size="small" color="#16a34a" />
      ) : (
        <Ionicons name="download-outline" size={17} color="#16a34a" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#16a34a55',
    backgroundColor: '#16a34a18',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
