import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RejectionEntryView } from '@/components/RejectionEntryView';

export default function RejectionEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    transId?: string;
    partNo?: string;
    serialNo?: string;
    productId?: string;
    from?: string;
  }>();

  const initialPart = params.partNo && params.serialNo ? {
    transId: String(params.transId || `${params.partNo}|${params.serialNo}`),
    partNo: String(params.partNo),
    serialNo: String(params.serialNo),
    productId: params.productId ? String(params.productId) : undefined,
  } : undefined;

  return (
    <RejectionEntryView
      initialPart={initialPart}
      onClose={params.from === 'history' ? () => router.replace('/History') : undefined}
    />
  );
}
