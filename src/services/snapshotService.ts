import type { MarketSnapshotRecord, ProcessedOptionRow } from '../types/optionChain';
import { fetchAllSnapshots, fetchSnapshotData, saveHourlySnapshotToDatabase } from './supabaseClient';

export const HOURLY_SLOTS = [
  '09:15',
  '10:15',
  '11:15',
  '12:15',
  '13:15',
  '14:15',
  '15:30'
] as const;

export type HourlySlotType = typeof HOURLY_SLOTS[number];

export function getClosestMarketHourSlot(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes < 9 * 60 + 45) return '09:15';
  if (totalMinutes < 10 * 60 + 45) return '10:15';
  if (totalMinutes < 11 * 60 + 45) return '11:15';
  if (totalMinutes < 12 * 60 + 45) return '12:15';
  if (totalMinutes < 13 * 60 + 45) return '13:15';
  if (totalMinutes < 14 * 60 + 45) return '14:15';
  return '15:30';
}

export function isMarketHours(): boolean {
  const now = new Date();
  const day = now.getDay();
  // Mon-Fri: 1 to 5
  if (day === 0 || day === 6) return false;
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTotal = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15; // 09:15
  const marketClose = 15 * 60 + 30; // 15:30
  return currentTotal >= marketOpen && currentTotal <= marketClose;
}

export interface AutoSaveConfig {
  enabled: boolean;
  intervalMinutes: number;
  lastSavedAt: string | null;
  nextSaveInSeconds: number;
}

export async function loadHistoricalSnapshotsList(): Promise<MarketSnapshotRecord[]> {
  return await fetchAllSnapshots();
}

export async function loadHistoricalSnapshot(snapshotId: string): Promise<{
  snapshot: MarketSnapshotRecord | null;
  rows: ProcessedOptionRow[];
}> {
  return await fetchSnapshotData(snapshotId);
}

export async function saveCurrentSnapshot(
  spotClose: number,
  rows: ProcessedOptionRow[],
  customSlot?: string,
  notes?: string
): Promise<{ success: boolean; snapshotId: string; message: string }> {
  const today = new Date().toISOString().split('T')[0];
  const slot = customSlot || getClosestMarketHourSlot();
  return await saveHourlySnapshotToDatabase(today, slot, spotClose, rows, notes);
}
