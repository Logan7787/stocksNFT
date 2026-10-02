import React from 'react';
import { X, Calculator } from 'lucide-react';

interface FormulasModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice: number;
}

export const FormulasModal: React.FC<FormulasModalProps> = ({ isOpen, onClose, spotPrice: _spotPrice }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#0f1523] border border-slate-300 dark:border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Custom Mathematical Formulas & Rules</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Business logic executed dynamically per strike</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-sm text-slate-800 dark:text-slate-200">
          {/* Formula 1: Call Premium */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-sky-300 dark:border-sky-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 font-mono">
                1. Call Premium Formula
              </span>
              <span className="px-2 py-0.5 text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 font-mono rounded border border-sky-300 dark:border-sky-500/30 font-semibold">
                Light Blue Highlight (#7dd3fc)
              </span>
            </div>
            <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-cyan-700 dark:text-cyan-300 text-sm font-bold shadow-inner">
              Call Premium = (Call Low + Put High) / 2
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Calculates synthetic Call baseline pricing by averaging intraday Call Low against opposing Put High. The minimum Call Premium across all strikes is automatically highlighted in Light Blue.
            </p>
          </div>

          {/* Formula 2: Put Premium */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-sky-300 dark:border-sky-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 font-mono">
                2. Put Premium Formula
              </span>
              <span className="px-2 py-0.5 text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 font-mono rounded border border-sky-300 dark:border-sky-500/30 font-semibold">
                Light Blue Highlight (#7dd3fc)
              </span>
            </div>
            <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-cyan-700 dark:text-cyan-300 text-sm font-bold shadow-inner">
              Put Premium = (Put Low + Call High) / 2
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Calculates synthetic Put baseline pricing by averaging intraday Put Low against opposing Call High. The minimum Put Premium across all strikes is highlighted in Light Blue.
            </p>
          </div>

          {/* Formula 3: Average Price (AVG) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-emerald-300 dark:border-emerald-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-mono">
                3. Average Price (AVG) Formula
              </span>
              <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-mono rounded border border-emerald-300 dark:border-emerald-500/30 font-semibold">
                Light Green Highlight (#86efac)
              </span>
            </div>
            <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-emerald-700 dark:text-emerald-300 text-sm font-bold shadow-inner">
              AVG = (Call Close + Put Close) / 2
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              The exact average of Call Close (LTP) and Put Close (LTP) for that strike. The cell(s) with the minimum AVG value in the option chain are highlighted in Light Green.
            </p>
          </div>

          {/* Table Layout & Highlighting Summary */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
              Automatic Highlighting Summary
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="w-4 h-4 rounded bg-[#f97316] shrink-0" />
                <span className="text-slate-800 dark:text-slate-300">
                  <strong className="text-orange-600 dark:text-orange-400">Orange (#f97316):</strong> At-The-Money (ATM) Strike
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="w-4 h-4 rounded bg-[#86efac] shrink-0" />
                <span className="text-slate-800 dark:text-slate-300">
                  <strong className="text-emerald-700 dark:text-emerald-400">Light Green (#86efac):</strong> Minimum AVG Price
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="w-4 h-4 rounded bg-[#7dd3fc] shrink-0" />
                <span className="text-slate-800 dark:text-slate-300">
                  <strong className="text-sky-700 dark:text-sky-400">Light Blue (#7dd3fc):</strong> Min CE & PE Premium
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="w-4 h-4 rounded bg-[#fde047] shrink-0" />
                <span className="text-slate-800 dark:text-slate-300">
                  <strong className="text-yellow-700 dark:text-yellow-400">Light Yellow (#fde047):</strong> Top 2 CE & PE Volume
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
