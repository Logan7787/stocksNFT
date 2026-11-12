import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { RawOptionData, ProcessedOptionRow } from '../src/types/optionChain';
import { processRawOptionRow, applyConditionalHighlights, calculateBreakLevels, round2 } from '../src/utils/formulas';

interface SettlementPayload {
  success: boolean;
  source: string;
  date: string;
  expiryDate: string;
  spotPrice: number;
  spotChange: number;
  spotChangePercent: number;
  previousClose: number;
  atmStrike: number;
  formulaAtmStrike: number;
  minAvg: number;
  rows: ProcessedOptionRow[];
  totalStrikes: number;
  breakLevels?: any;
}

function getISTDateString(): string {
  const now = new Date();
  // Format as YYYY-MM-DD in Asia/Kolkata timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts;
}

function getISTHours(): number {
  const now = new Date();
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).format(now);
  return Number(hourStr) || 0;
}

function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length >= headers.length) {
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      results.push(row);
    }
  }
  return results;
}

async function fetchBhavcopyFromNse(dateStr: string): Promise<{ csv: string; filename: string } | null> {
  const dateCompact = dateStr.replace(/-/g, '');
  const urlUdiff = `https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${dateCompact}_F_0000.csv.zip`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Referer': 'https://www.nseindia.com/',
  };

  try {
    const res = await fetch(urlUdiff, { headers });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      const csvEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.csv'));
      if (csvEntry) {
        return {
          csv: zip.readAsText(csvEntry),
          filename: csvEntry.entryName,
        };
      }
    }
  } catch (err) {
    console.warn(`UDiFF fetch error for ${dateStr}:`, err);
  }

  // Classic bhavcopy fallback
  const d = new Date(dateStr);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dayStr = String(d.getDate()).padStart(2, '0');
  const monStr = months[d.getMonth()];
  const yearStr = d.getFullYear();
  const urlClassic = `https://nsearchives.nseindia.com/archives/fo/bhav/fo${dayStr}${monStr}${yearStr}bhav.csv.zip`;

  try {
    const res = await fetch(urlClassic, { headers });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      const csvEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.csv'));
      if (csvEntry) {
        return {
          csv: zip.readAsText(csvEntry),
          filename: csvEntry.entryName,
        };
      }
    }
  } catch (err) {
    console.warn(`Classic bhavcopy fetch error for ${dateStr}:`, err);
  }

  return null;
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const queryDate = req.query?.date as string | undefined;
  const targetDate = queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)
    ? queryDate
    : getISTDateString();

  try {
    // 1. Attempt to fetch fresh Bhavcopy directly from NSE Archives
    const bhavResult = await fetchBhavcopyFromNse(targetDate);

    if (bhavResult) {
      const csvRows = parseCsv(bhavResult.csv);
      const niftyOptions: Record<string, string>[] = [];
      const expiries = new Set<string>();
      let spotPrice = 0.0;

      for (const row of csvRows) {
        const symb = (row.TckrSymb || row.SYMBOL || '').trim().toUpperCase();
        const optType = (row.OptnTp || row.OPTION_TYP || '').trim().toUpperCase();

        if (symb === 'NIFTY' && (optType === 'CE' || optType === 'PE')) {
          niftyOptions.push(row);
          const xpry = (row.XpryDt || row.EXPIRY_DT || '').trim();
          if (xpry) expiries.add(xpry);

          if (!spotPrice && row.UndrlygPric) {
            const val = parseFloat(row.UndrlygPric);
            if (!isNaN(val) && val > 0) spotPrice = val;
          }
        }
      }

      if (niftyOptions.length > 0) {
        // Auto-select active weekly expiry
        const sortedExpiries = Array.from(expiries).sort();
        const upcoming = sortedExpiries.filter(e => e >= targetDate);
        let targetExpiry = '';
        if (upcoming.length > 1 && upcoming[0] === targetDate) {
          targetExpiry = upcoming[1];
        } else if (upcoming.length > 0) {
          targetExpiry = upcoming[0];
        } else {
          targetExpiry = sortedExpiries[0] || '2026-11-17';
        }

        // Build strike map
        const strikeMap = new Map<number, RawOptionData>();

        for (const row of niftyOptions) {
          const xpry = (row.XpryDt || row.EXPIRY_DT || '').trim();
          if (targetExpiry && xpry !== targetExpiry) continue;

          const strike = Math.round(parseFloat(row.StrkPric || row.STRIKE_PR || '0'));
          if (!strike) continue;

          if (!strikeMap.has(strike)) {
            strikeMap.set(strike, {
              strike,
              call_close: 0,
              call_prev_close: 0,
              call_ltp: 0,
              call_volume: 0,
              call_high: 0,
              call_low: 0,
              put_close: 0,
              put_prev_close: 0,
              put_ltp: 0,
              put_volume: 0,
              put_high: 0,
              put_low: 0,
              call_settlement_close: 0,
              put_settlement_close: 0,
            });
          }

          const entry = strikeMap.get(strike)!;
          const optType = (row.OptnTp || row.OPTION_TYP || '').trim().toUpperCase();
          const cls = parseFloat(row.SttlmPric || row.ClsPric || row.CLOSE || '0') || 0;
          const pcls = parseFloat(row.PrvsClsgPric || row.PREV_CL || '0') || cls;
          const ltp = parseFloat(row.LastPric || row.LTP || '0') || cls;
          const vol = parseInt(row.TtlTradgVol || row.CONTRACTS || '0', 10) || 0;
          const hgh = parseFloat(row.HghPric || row.HIGH || '0') || cls;
          const low = parseFloat(row.LwPric || row.LOW || '0') || cls;

          if (optType === 'CE') {
            entry.call_close = cls;
            entry.call_settlement_close = cls;
            entry.call_prev_close = pcls;
            entry.call_ltp = ltp;
            entry.call_volume = vol;
            entry.call_high = hgh;
            entry.call_low = low;
          } else if (optType === 'PE') {
            entry.put_close = cls;
            entry.put_settlement_close = cls;
            entry.put_prev_close = pcls;
            entry.put_ltp = ltp;
            entry.put_volume = vol;
            entry.put_high = hgh;
            entry.put_low = low;
          }
        }

        const rawRows = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);

        if (spotPrice <= 0 && rawRows.length > 0) {
          const atm = Math.round(rawRows[Math.floor(rawRows.length / 2)].strike / 50) * 50;
          spotPrice = atm;
        }

        const processed = rawRows.map(r => processRawOptionRow(r));
        const { highlightedRows, metrics } = applyConditionalHighlights(processed, spotPrice);
        const breakLevels = calculateBreakLevels(highlightedRows, spotPrice);

        // Previous close resolution from most recent prior settlement file
        let prevClose = 0;
        let spotChange = 0;
        let spotChangePercent = 0;

        try {
          const dataDir = path.join(process.cwd(), 'public/data');
          if (fs.existsSync(dataDir)) {
            const priorDates = fs.readdirSync(dataDir)
              .filter(f => f.startsWith('settlement_') && f.endsWith('.json'))
              .map(f => f.replace('settlement_', '').replace('.json', ''))
              .filter(d => d < targetDate)
              .sort()
              .reverse();

            if (priorDates.length > 0) {
              const priorFile = path.join(dataDir, `settlement_${priorDates[0]}.json`);
              const priorData = JSON.parse(fs.readFileSync(priorFile, 'utf8'));
              if (priorData && priorData.spotPrice) {
                prevClose = Number(priorData.spotPrice);
                spotChange = round2(spotPrice - prevClose);
                spotChangePercent = round2((spotChange / prevClose) * 100);
              }
            }
          }
        } catch {}

        if (prevClose <= 0) {
          prevClose = spotPrice;
        }

        res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
        return res.status(200).json({
          success: true,
          source: 'NSE Official Archives Bhavcopy (Live Serverless)',
          date: targetDate,
          expiryDate: targetExpiry,
          spotPrice,
          spotChange,
          spotChangePercent,
          previousClose: prevClose,
          atmStrike: metrics.atmStrike,
          formulaAtmStrike: breakLevels?.formulaAtmStrike || metrics.atmStrike,
          minAvg: metrics.minAvgValue,
          rows: highlightedRows,
          totalStrikes: highlightedRows.length,
          breakLevels,
        });
      }
    }

    // 2. Fallback to cached local static settlement file if NSE hasn't uploaded today's Bhavcopy yet
    const localSettlementPath = path.join(process.cwd(), `public/data/settlement_${targetDate}.json`);
    const fallbackPath = fs.existsSync(localSettlementPath)
      ? localSettlementPath
      : path.join(process.cwd(), 'public/data/latest_settlement.json');

    if (fs.existsSync(fallbackPath)) {
      const data = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
      return res.status(200).json({
        ...data,
        success: true,
        source: 'Cached Settlement JSON (Static Fallback)',
      });
    }

    return res.status(404).json({
      success: false,
      message: `No settlement data available for ${targetDate} yet. NSE uploads daily settlement around 20:30 IST.`,
    });
  } catch (error: any) {
    console.error('Settlement handler error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error processing NSE settlement',
    });
  }
}
