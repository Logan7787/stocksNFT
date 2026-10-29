import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../common/Header';
import { HighlightLegend } from '../table/HighlightLegend';
import { OptionChainDesktopTable } from '../table/OptionChainDesktopTable';
import { OptionChainMobileTable } from '../table/OptionChainMobileTable';
import { FormulasModal } from '../modals/FormulasModal';
import { SettingsModal } from '../modals/SettingsModal';
import { SnapshotManagerModal } from '../modals/SnapshotManagerModal';
import { NseDataRetrieveModal } from '../modals/NseDataRetrieveModal';
import { ActiveTradeSetupCard } from './ActiveTradeSetupCard';
import { TradeSettingsCard } from './TradeSettingsCard';
import { NiftyOptionsAnalysisPage } from '../niftyAnalysis/NiftyOptionsAnalysisPage';
import { PreviousDayClosePage } from './PreviousDayClosePage';
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
  BrokerStatus,
  ConnectionMode,
  TradeSettings
} from '../../types/optionChain';
import { applyConditionalHighlights, round2 } from '../../utils/formulas';
import { 
  getStoredTradeSettings, 
  saveStoredTradeSettings, 
  evaluateAllTradeSignals 
} from '../../utils/tradeEngine';
import { CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { useMemo } from 'react';


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
  const [isNseRetrieveOpen, setIsNseRetrieveOpen] = useState<boolean>(false);
  const [strikeFilter, setStrikeFilter] = useState<'all' | 'atm500'>('atm500');
  const [isMobileCompact, setIsMobileCompact] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Broker Config & Status
  const [brokerConfig, setBrokerConfig] = useState<BrokerApiConfig>(niftyMarketService.getBrokerConfig());
  const [brokerStatus, setBrokerStatus] = useState<BrokerStatus>(niftyMarketService.getBrokerStatus());

  // Trade Engine State (Strict Risk Management: Max SL Points & Risk-to-Reward Ratio)
  const [tradeSettings, setTradeSettings] = useState<TradeSettings>(getStoredTradeSettings());

  // Active Navigation Module Route ('/' vs '/nifty-options' vs '/previous-close')
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const p = window.location.pathname;
    const h = window.location.hash.replace('#', '');
    if (p === '/nifty-options' || h === '/nifty-options' || h === 'nifty-options') return '/nifty-options';
    if (p === '/previous-close' || h === '/previous-close' || h === 'previous-close') return '/previous-close';
    return '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      const h = window.location.hash.replace('#', '');
      if (p === '/nifty-options' || h === '/nifty-options' || h === 'nifty-options') {
        setCurrentRoute('/nifty-options');
      } else if (p === '/previous-close' || h === '/previous-close' || h === 'previous-close') {
        setCurrentRoute('/previous-close');
      } else {
        setCurrentRoute('/');
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    window.history.pushState(null, '', route);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast(null);
    setTimeout(() => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
    }, 50);
  };

  const handleUpdateTradeSettings = (newSettings: TradeSettings) => {
    setTradeSettings(newSettings);
    saveStoredTradeSettings(newSettings);
    showToast(`Trade settings saved: Max SL ${newSettings.maxSlPoints} pts, R:R 1:${newSettings.riskRewardRatio}`, 'success');
  };

  const handleTriggerTestBreakout = (type: 'CE' | 'PE') => {
    niftyMarketService.triggerBreakoutShock(type);
    showToast(`Simulated ${type} Breakout on ATM strike!`, 'success');
  };

  // Dynamic Real-Time Intraday CE / PE Trade Signals & Active Setups Calculation
  const { rows: rowsWithSignals, activeSetups, atmRow, nearestItmCeRow, nearestItmPeRow } = useMemo(() => {
    return evaluateAllTradeSignals(rows, spotPrice, tradeSettings);
  }, [rows, spotPrice, tradeSettings]);

  // Screen filter state: All strikes vs ATM ± 500 strikes
  const displayedRowsWithSignals = useMemo(() => {
    if (strikeFilter === 'atm500') {
      const atm = metrics.atmStrike || (spotPrice > 0 ? Math.round(spotPrice / 50) * 50 : 22700);
      return rowsWithSignals.filter(r => Math.abs(r.strike - atm) <= 500);
    }
    return rowsWithSignals;
  }, [rowsWithSignals, strikeFilter, metrics.atmStrike, spotPrice]);

  // Subscribe to Broker Status updates
  useEffect(() => {
    const unsub = niftyMarketService.subscribeBrokerStatus((st) => {
      setBrokerStatus(st);
      if (st.status === 'connected') {
        setConnectionMode('broker_api');
      } else if (st.status === 'token_expired' || st.status === 'error') {
        // Fallback connection mode
      }
    });
    return () => unsub();
  }, []);

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
      setSpotChangePercent(data.metrics.spotChangePercent);
      setRows(data.rows);
      setMetrics(data.metrics);
    });

    const handleCloseSyncEvent = () => {
      const liveRows = niftyMarketService.getProcessedRows();
      if (liveRows && liveRows.length > 0) {
        setRows(liveRows);
        setSpotPrice(niftyMarketService.getSpotPrice());
        setSpotChange(niftyMarketService.getSpotChange());
        setSpotChangePercent(niftyMarketService.getSpotChangePercent());
      }
    };
    window.addEventListener('nifty-market-close-synced', handleCloseSyncEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('nifty-market-close-synced', handleCloseSyncEvent);
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
        onOpenNseRetrieveModal={() => setIsNseRetrieveOpen(true)}
        connectionMode={connectionMode}
        historicalSnapshots={snapshots}
        isMobileCompact={isMobileCompact}
        onToggleMobileCompact={() => setIsMobileCompact(!isMobileCompact)}
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
      />

      {/* When on NIFTY Options Analysis page */}
      {currentRoute === '/nifty-options' ? (
        <main className="flex-1">
          <NiftyOptionsAnalysisPage />
        </main>
      ) : currentRoute === '/previous-close' ? (
        <main className="flex-1">
          <PreviousDayClosePage
            onOpenSettings={() => setIsSettingsOpen(true)}
            referenceSpotPrice={spotPrice}
            spotChange={spotChange}
            spotChangePercent={spotChangePercent}
            currentRows={rows}
            currentMetrics={metrics}
          />
        </main>
      ) : (
        <>
          {/* Broker Live Feed Warning / Expired Token Banner */}
          {selectedSlot === 'LIVE' && brokerConfig.enabled && brokerStatus.error && (
            <div className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-300 dark:border-amber-700/60 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-semibold">{brokerStatus.error}</span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all shrink-0"
              >
                <Key className="w-3 h-3" />
                <span>Open Settings & Update Token</span>
              </button>
            </div>
          )}

          {/* Conditional Highlights Legend & Market Pulse Bar */}
          <HighlightLegend
            metrics={metrics}
            autoSaveCountdown={autoSaveCountdown}
            isAutoSaveEnabled={isAutoSaveEnabled}
            totalStrikesCount={rows.length}
          />

          {/* Main Table Content Container */}
          <main className="flex-1 p-2 sm:p-4 max-w-[1600px] w-full mx-auto space-y-3">
            {/* Active Trade Setup Banner (Top live calculation card) */}
            <ActiveTradeSetupCard
              activeSetups={activeSetups}
              settings={tradeSettings}
              atmRow={atmRow}
              nearestItmCeRow={nearestItmCeRow}
              nearestItmPeRow={nearestItmPeRow}
              spotPrice={spotPrice}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onTriggerTestBreakout={handleTriggerTestBreakout}
              isSimulated={connectionMode === 'simulated'}
            />

            {/* Global Trade Settings (Admin Panel) */}
            <TradeSettingsCard
              settings={tradeSettings}
              onUpdateSettings={handleUpdateTradeSettings}
            />

            {/* Strike Filter Range Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-300 dark:border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">Strikes:</span>
                <button
                  onClick={() => setStrikeFilter('atm500')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    strikeFilter === 'atm500'
                      ? 'bg-cyan-500 text-black shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  ATM ±500 ({displayedRowsWithSignals.length} Active Strikes)
                </button>
                <button
                  onClick={() => setStrikeFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    strikeFilter === 'all'
                      ? 'bg-cyan-500 text-black shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({rowsWithSignals.length} Strikes)
                </button>
              </div>

              <button
                onClick={() => setIsNseRetrieveOpen(true)}
                className="px-2.5 py-1 bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300 rounded-lg font-bold hover:bg-cyan-200 dark:hover:bg-cyan-500/30 transition-all cursor-pointer flex items-center gap-1 border border-cyan-300 dark:border-cyan-500/30"
              >
                <span>View / Verify Data from NSE</span>
              </button>
            </div>

            {/* Desktop View (default on lg+) */}
            <div className="hidden lg:block">
              <OptionChainDesktopTable rows={displayedRowsWithSignals} spotPrice={spotPrice} />
            </div>

            {/* Mobile / Tablet Responsive View */}
            <div className="lg:hidden">
              <OptionChainMobileTable rows={displayedRowsWithSignals} spotPrice={spotPrice} metrics={metrics} />
            </div>
          </main>
        </>
      )}

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
        previousClose={niftyMarketService.getPreviousClose()}
        onSetPreviousClose={(pc) => {
          niftyMarketService.setPreviousClose(pc);
          showToast(`Previous Close updated to ₹${pc}`, 'success');
        }}
        onCalibrateOfficialClose={(spot, prevClose) => {
          niftyMarketService.calibrateToOfficialClose(spot, prevClose);
          showToast(`Calibrated to NSE Official Settlement Close (Spot: ₹${spot})`, 'success');
        }}
        onSyncBrokerQuote={async () => {
          const res = await niftyMarketService.syncBrokerQuote();
          if (res.success) {
            showToast(res.message, 'success');
          } else {
            showToast(res.message, 'error');
          }
          return res;
        }}
        tradeSettings={tradeSettings}
        onUpdateTradeSettings={handleUpdateTradeSettings}
      />

      <SnapshotManagerModal
        isOpen={isSnapshotsOpen}
        onClose={() => setIsSnapshotsOpen(false)}
        snapshots={snapshots}
        onLoadSnapshot={handleLoadSnapshotById}
        onExportCsv={handleExportCsv}
        activeSlot={selectedSlot}
      />

      <NseDataRetrieveModal
        isOpen={isNseRetrieveOpen}
        onClose={() => setIsNseRetrieveOpen(false)}
        onApplyToLiveChain={(res) => {
          setSpotPrice(res.spotPrice);
          setSpotChange(res.spotChange);
          setSpotChangePercent(res.spotChangePercent);
          setRows(res.processedRows);
          setMetrics(res.metrics);
        }}
        onApplyToClosePage={(_res) => {
          handleNavigate('/previous-close');
        }}
        onToast={showToast}
      />
    </div>
  );
};
