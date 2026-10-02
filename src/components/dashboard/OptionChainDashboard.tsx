import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../common/Header';
import { HighlightLegend } from '../table/HighlightLegend';
import { OptionChainDesktopTable } from '../table/OptionChainDesktopTable';
import { OptionChainMobileTable } from '../table/OptionChainMobileTable';
import { FormulasModal } from '../modals/FormulasModal';
import { SettingsModal } from '../modals/SettingsModal';
import { SnapshotManagerModal } from '../modals/SnapshotManagerModal';
import { 
  niftyMarketService 
} from '../../services/niftyApi';
import { 
  loadHistoricalSnapshotsList, 
  loadHistoricalSnapshot, 
  saveCurrentSnapshot,
  getClosestMarketHourSlot 
} from '../../services/snapshotService';
import type { 
  ProcessedOptionRow, 
  MarketMetrics, 
  MarketSnapshotRecord, 
  BrokerApiConfig,
  ConnectionMode
} from '../../types/optionChain';
import { applyConditionalHighlights, round2 } from '../../utils/formulas';
import { CheckCircle2 } from 'lucide-react';

export const OptionChainDashboard: React.FC = () => {
  // Option Chain State
  const [rows, setRows] = useState<ProcessedOptionRow[]>([]);
  const [spotPrice, setSpotPrice] = useState<number>(22620.45);
  const [spotChange, setSpotChange] = useState<number>(40.45);
  const [spotChangePercent, setSpotChangePercent] = useState<number>(0.18);
  const [metrics, setMetrics] = useState<MarketMetrics>({
    spotPrice: 22620.45,
    spotChange: 40.45,
    spotChangePercent: 0.18,
    atmStrike: 22600,
    totalCallVolume: 0,
    totalPutVolume: 0,
    pcrVolume: 1,
    maxPainStrike: 22600,
    minAvgValue: 0,
    minCallPremiumValue: 0,
    minPutPremiumValue: 0,
    topCallVolumeStrikes: [],
    topPutVolumeStrikes: [],
    timestamp: '',
  });

  // Streaming & Interval State
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [tickInterval, setTickInterval] = useState<number>(1000);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('simulated');

  // Date & Slot Selection
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<string>('LIVE');

  // Snapshots Archive State
  const [snapshots, setSnapshots] = useState<MarketSnapshotRecord[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number>(3600); // 1 hour = 3600s
  const [isAutoSaveEnabled] = useState<boolean>(true);

  // Modals & UI View State
  const [isFormulasOpen, setIsFormulasOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSnapshotsOpen, setIsSnapshotsOpen] = useState<boolean>(false);
  const [isMobileCompact, setIsMobileCompact] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Broker Config
  const [brokerConfig, setBrokerConfig] = useState<BrokerApiConfig>(niftyMarketService.getBrokerConfig());

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast(null);
    setTimeout(() => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
    }, 50);
  };

  // 1. Initial Load of Historical Snapshots list
  const refreshSnapshotsList = useCallback(async () => {
    const list = await loadHistoricalSnapshotsList();
    setSnapshots(list);
  }, []);

  useEffect(() => {
    refreshSnapshotsList();
  }, [refreshSnapshotsList]);

  // 2. Real-Time Streaming Subscription
  useEffect(() => {
    if (selectedSlot !== 'LIVE') {
      niftyMarketService.stopStreaming();
      return;
    }

    if (isStreaming) {
      niftyMarketService.startStreaming();
    } else {
      niftyMarketService.stopStreaming();
    }

    const unsubscribe = niftyMarketService.subscribe((data) => {
      setSpotPrice(data.spotPrice);
      setSpotChange(data.spotChange);
      setSpotChangePercent(round2((data.spotChange / (data.spotPrice - data.spotChange)) * 100));
      setRows(data.rows);
      setMetrics(data.metrics);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedSlot, isStreaming]);

  // 3. Auto-Save 1-Hour Timer Effect
  useEffect(() => {
    if (!isAutoSaveEnabled || selectedSlot !== 'LIVE') return;

    const timer = setInterval(() => {
      setAutoSaveCountdown((prev) => {
        if (prev <= 1) {
          handleSaveSnapshot(true);
          return 3600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoSaveEnabled, selectedSlot, spotPrice, rows]);

  // 4. Save Hourly Snapshot (Manual or Auto)
  const handleSaveSnapshot = async (isAuto = false) => {
    if (rows.length === 0) return;
    setIsSaving(true);
    try {
      const slot = getClosestMarketHourSlot();
      const res = await saveCurrentSnapshot(
        spotPrice,
        rows,
        slot,
        isAuto ? `Auto Hourly Snapshot (${slot})` : `Manual Admin Snapshot (${slot})`
      );

      if (res.success) {
        showToast(res.message, 'success');
        refreshSnapshotsList();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving snapshot', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Load Historical Snapshot by Slot or ID
  const handleSelectSlot = async (slot: string) => {
    setSelectedSlot(slot);
    if (slot === 'LIVE') {
      setConnectionMode(brokerConfig.enabled ? 'broker_api' : 'simulated');
      setIsStreaming(true);
      return;
    }

    // Historical Slot
    setConnectionMode('historical');
    setIsStreaming(false);

    // Find snapshot for date & slot
    const target = snapshots.find(s => s.snapshot_date === selectedDate && s.hour_slot === slot);
    if (target) {
      const loaded = await loadHistoricalSnapshot(target.id);
      if (loaded.snapshot && loaded.rows.length > 0) {
        const spot = Number(loaded.snapshot.spot_close);
        setSpotPrice(spot);
        const { highlightedRows, metrics: loadedMetrics } = applyConditionalHighlights(loaded.rows, spot);
        setRows(highlightedRows);
        setMetrics(loadedMetrics);
        showToast(`Loaded snapshot for ${selectedDate} [${slot} IST]`, 'info');
      }
    } else {
      showToast(`No database record found for ${selectedDate} at ${slot}`, 'info');
    }
  };

  const handleLoadSnapshotById = async (snapshotId: string) => {
    const loaded = await loadHistoricalSnapshot(snapshotId);
    if (loaded.snapshot && loaded.rows.length > 0) {
      setSelectedDate(loaded.snapshot.snapshot_date);
      setSelectedSlot(loaded.snapshot.hour_slot);
      setConnectionMode('historical');
      setIsStreaming(false);

      const spot = Number(loaded.snapshot.spot_close);
      setSpotPrice(spot);
      const { highlightedRows, metrics: loadedMetrics } = applyConditionalHighlights(loaded.rows, spot);
      setRows(highlightedRows);
      setMetrics(loadedMetrics);
      showToast(`Loaded snapshot: ${loaded.snapshot.snapshot_date} ${loaded.snapshot.hour_slot}`, 'info');
    }
  };

  // 6. CSV Export Function
  const handleExportCsv = (_snapshotId?: string) => {
    const exportRows = rows;
    const title = `NIFTY_Option_Chain_${selectedDate}_${selectedSlot}`;

    const headers = [
      'CALL_VOLUME',
      'CALL_PREMIUM',
      'CALL_AVG',
      'CALL_CLOSE',
      'CALL_LOW',
      'CALL_HIGH',
      'STRIKE',
      'PUT_CLOSE',
      'PUT_AVG',
      'PUT_PREMIUM',
      'PUT_VOLUME',
      'PUT_LOW',
      'PUT_HIGH',
    ];

    const csvContent = [
      headers.join(','),
      ...exportRows.map(r => [
        r.call_volume,
        r.call_premium,
        r.call_avg,
        r.call_close,
        r.call_low,
        r.call_high,
        r.strike,
        r.put_close,
        r.put_avg,
        r.put_premium,
        r.put_volume,
        r.put_low,
        r.put_high,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Option chain exported to CSV successfully!');
  };

  // Settings Handlers
  const handleSaveBrokerConfig = (cfg: BrokerApiConfig) => {
    setBrokerConfig(cfg);
    niftyMarketService.setBrokerConfig(cfg);
    if (cfg.enabled) {
      setConnectionMode('broker_api');
    } else {
      setConnectionMode('simulated');
    }
  };

  const handleSetTickInterval = (ms: number) => {
    setTickInterval(ms);
    niftyMarketService.setTickInterval(ms);
  };

  const handleSetSpotPrice = (price: number) => {
    setSpotPrice(price);
    niftyMarketService.setSpotPrice(price);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Toast Notification Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fadeIn">
          <div className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-mono backdrop-blur-xl ${
            toast.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-500 text-emerald-900 dark:text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-500 text-rose-900 dark:text-rose-200'
              : 'bg-cyan-50 dark:bg-cyan-950/90 border-cyan-500 text-cyan-900 dark:text-cyan-200'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        spotPrice={spotPrice}
        spotChange={spotChange}
        spotChangePercent={spotChangePercent}
        selectedDate={selectedDate}
        selectedSlot={selectedSlot}
        onSelectSlot={handleSelectSlot}
        onSelectDate={(d) => {
          setSelectedDate(d);
          if (selectedSlot !== 'LIVE') {
            handleSelectSlot(selectedSlot);
          }
        }}
        isStreaming={isStreaming}
        onToggleStreaming={() => setIsStreaming(!isStreaming)}
        onSaveSnapshot={() => handleSaveSnapshot(false)}
        isSaving={isSaving}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenFormulas={() => setIsFormulasOpen(true)}
        onOpenSnapshotsManager={() => setIsSnapshotsOpen(true)}
        connectionMode={connectionMode}
        historicalSnapshots={snapshots}
        isMobileCompact={isMobileCompact}
        onToggleMobileCompact={() => setIsMobileCompact(!isMobileCompact)}
      />

      {/* Conditional Highlights Legend & Market Pulse Bar */}
      <HighlightLegend
        metrics={metrics}
        autoSaveCountdown={autoSaveCountdown}
        isAutoSaveEnabled={isAutoSaveEnabled}
        totalStrikesCount={rows.length}
      />

      {/* Main Table Content Container */}
      <main className="flex-1 p-2 sm:p-4 max-w-[1600px] w-full mx-auto">
        {/* Desktop View (default on lg+) */}
        <div className="hidden lg:block">
          <OptionChainDesktopTable rows={rows} spotPrice={spotPrice} />
        </div>

        {/* Mobile / Tablet Responsive View */}
        <div className="lg:hidden">
          <OptionChainMobileTable rows={rows} spotPrice={spotPrice} metrics={metrics} />
        </div>
      </main>

      {/* Modals */}
      <FormulasModal
        isOpen={isFormulasOpen}
        onClose={() => setIsFormulasOpen(false)}
        spotPrice={spotPrice}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        brokerConfig={brokerConfig}
        onSaveBrokerConfig={handleSaveBrokerConfig}
        tickInterval={tickInterval}
        onSetTickInterval={handleSetTickInterval}
        spotPrice={spotPrice}
        onSetSpotPrice={handleSetSpotPrice}
      />

      <SnapshotManagerModal
        isOpen={isSnapshotsOpen}
        onClose={() => setIsSnapshotsOpen(false)}
        snapshots={snapshots}
        onLoadSnapshot={handleLoadSnapshotById}
        onExportCsv={handleExportCsv}
        activeSlot={selectedSlot}
      />
    </div>
  );
};
