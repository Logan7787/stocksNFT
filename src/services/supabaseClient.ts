import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { MarketSnapshotRecord, OptionChainHourlyDataRecord, ProcessedOptionRow } from '../types/optionChain';

// Default / fallback keys or localStorage overrides
const LOCAL_STORAGE_KEY_URL = 'nifty_supabase_url';
const LOCAL_STORAGE_KEY_ANON = 'nifty_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY_URL) || envUrl;
  const savedAnon = localStorage.getItem(LOCAL_STORAGE_KEY_ANON) || envAnon;

  return {
    url: savedUrl.trim(),
    anonKey: savedAnon.trim(),
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  localStorage.setItem(LOCAL_STORAGE_KEY_URL, url.trim());
  localStorage.setItem(LOCAL_STORAGE_KEY_ANON, anonKey.trim());
  // Re-initialize client
  initSupabaseClient();
}

let supabaseInstance: SupabaseClient | null = null;

export function initSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (url && anonKey && url.startsWith('http')) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseInstance;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      supabaseInstance = null;
      return null;
    }
  }
  supabaseInstance = null;
  return null;
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    return initSupabaseClient();
  }
  return supabaseInstance;
}

/**
 * Local fallback snapshot storage for zero-dependency offline/demo mode
 */
const LOCAL_SNAPSHOTS_KEY = 'nifty_local_market_snapshots_v1';
const LOCAL_ROWS_KEY = 'nifty_local_option_rows_v1';

export async function fetchAllSnapshots(): Promise<MarketSnapshotRecord[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .order('hour_slot', { ascending: false });

      if (!error && data) {
        return data as MarketSnapshotRecord[];
      }
    } catch (err) {
      console.warn('Supabase fetchAllSnapshots error, falling back to local:', err);
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(LOCAL_SNAPSHOTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [];
}

export async function fetchSnapshotData(snapshotId: string): Promise<{
  snapshot: MarketSnapshotRecord | null;
  rows: ProcessedOptionRow[];
}> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const [snapRes, rowsRes] = await Promise.all([
        supabase.from('market_snapshots').select('*').eq('id', snapshotId).single(),
        supabase.from('option_chain_hourly_data').select('*').eq('snapshot_id', snapshotId).order('strike', { ascending: true })
      ]);

      if (snapRes.data && rowsRes.data) {
        const rows: ProcessedOptionRow[] = rowsRes.data.map((r: any) => ({
          strike: Number(r.strike),
          call_volume: Number(r.call_volume),
          call_premium: Number(r.call_premium),
          call_avg: Number(r.call_avg),
          call_close: Number(r.call_close),
          call_low: Number(r.call_low),
          call_high: Number(r.call_high),
          put_close: Number(r.put_close),
          put_avg: Number(r.put_avg),
          put_premium: Number(r.put_premium),
          put_volume: Number(r.put_volume),
          put_low: Number(r.put_low),
          put_high: Number(r.put_high),
        }));

        return {
          snapshot: snapRes.data as MarketSnapshotRecord,
          rows,
        };
      }
    } catch (err) {
      console.warn('Supabase fetchSnapshotData error, trying local:', err);
    }
  }

  // Fallback
  try {
    const snapshots: MarketSnapshotRecord[] = JSON.parse(localStorage.getItem(LOCAL_SNAPSHOTS_KEY) || '[]');
    const rowsMap: Record<string, ProcessedOptionRow[]> = JSON.parse(localStorage.getItem(LOCAL_ROWS_KEY) || '{}');
    const targetSnap = snapshots.find(s => s.id === snapshotId) || null;
    const rows = rowsMap[snapshotId] || [];
    return { snapshot: targetSnap, rows };
  } catch (e) {
    return { snapshot: null, rows: [] };
  }
}

export async function saveHourlySnapshotToDatabase(
  dateStr: string,
  hourSlot: string,
  spotClose: number,
  rows: ProcessedOptionRow[],
  notes?: string
): Promise<{ success: boolean; snapshotId: string; message: string }> {
  const supabase = getSupabase();
  const snapshotId = crypto.randomUUID ? crypto.randomUUID() : `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const newSnapshot: MarketSnapshotRecord = {
    id: snapshotId,
    snapshot_date: dateStr,
    hour_slot: hourSlot,
    spot_close: spotClose,
    notes: notes || `Auto-saved at ${new Date().toLocaleTimeString()}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      // 1. Upsert / Insert snapshot header
      const { data: snapData, error: snapErr } = await supabase
        .from('market_snapshots')
        .upsert(
          {
            snapshot_date: dateStr,
            hour_slot: hourSlot,
            spot_close: spotClose,
            notes: newSnapshot.notes,
          },
          { onConflict: 'snapshot_date,hour_slot' }
        )
        .select()
        .single();

      if (snapErr) {
        console.warn('Supabase snapshot insert error:', snapErr);
        throw snapErr;
      }

      const dbSnapshotId = snapData.id;

      // 2. Delete existing rows for this snapshot if overwriting
      await supabase.from('option_chain_hourly_data').delete().eq('snapshot_id', dbSnapshotId);

      // 3. Prepare rows
      const dbRows: OptionChainHourlyDataRecord[] = rows.map((r) => ({
        snapshot_id: dbSnapshotId,
        strike: r.strike,
        call_low: r.call_low,
        call_high: r.call_high,
        call_close: r.call_close,
        call_volume: r.call_volume,
        call_avg: r.call_avg,
        call_premium: r.call_premium,
        put_low: r.put_low,
        put_high: r.put_high,
        put_close: r.put_close,
        put_volume: r.put_volume,
        put_avg: r.put_avg,
        put_premium: r.put_premium,
      }));

      // Batch insert rows
      const { error: rowsErr } = await supabase.from('option_chain_hourly_data').insert(dbRows);
      if (rowsErr) {
        console.warn('Supabase option rows insert error:', rowsErr);
        throw rowsErr;
      }

      return {
        success: true,
        snapshotId: dbSnapshotId,
        message: `Successfully saved ${rows.length} strike rows to Supabase database for ${hourSlot}!`,
      };
    } catch (err: any) {
      console.warn('Supabase save failed, saving to local fallback storage:', err.message || err);
    }
  }

  // Fallback Local Storage
  try {
    const existingSnapshots: MarketSnapshotRecord[] = JSON.parse(localStorage.getItem(LOCAL_SNAPSHOTS_KEY) || '[]');
    const existingRowsMap: Record<string, ProcessedOptionRow[]> = JSON.parse(localStorage.getItem(LOCAL_ROWS_KEY) || '{}');

    // Remove duplicates for same date & slot
    const filteredSnapshots = existingSnapshots.filter(
      s => !(s.snapshot_date === dateStr && s.hour_slot === hourSlot)
    );
    filteredSnapshots.unshift(newSnapshot);

    existingRowsMap[newSnapshot.id] = rows;

    localStorage.setItem(LOCAL_SNAPSHOTS_KEY, JSON.stringify(filteredSnapshots));
    localStorage.setItem(LOCAL_ROWS_KEY, JSON.stringify(existingRowsMap));

    return {
      success: true,
      snapshotId: newSnapshot.id,
      message: `Saved snapshot locally (${hourSlot})! To sync to PostgreSQL, connect Supabase in Settings.`,
    };
  } catch (err: any) {
    return {
      success: false,
      snapshotId: '',
      message: err.message || 'Failed to save snapshot',
    };
  }
}
