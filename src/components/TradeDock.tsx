import React, { useState, useMemo } from 'react';
import { Asset, TradeDirection } from '../types/trading';
import { Clock, ArrowUpDown, Plus, Minus } from 'lucide-react';
import { playClickSound } from '../utils/audio';

interface TradeDockProps {
  asset: Asset;
  onInitiateTrade: (direction: TradeDirection, amount: number, durationSeconds: number) => void;
  userBalance: number;
  durationSeconds: number;
  setDurationSeconds: (duration: number) => void;
  onOpenPendingTrade?: () => void;
}

export const TradeDock: React.FC<TradeDockProps> = ({
  asset,
  onInitiateTrade,
  userBalance,
  durationSeconds,
  setDurationSeconds,
  onOpenPendingTrade,
}) => {
  const [investMode, setInvestMode] = useState<'$' | '%'>('$');
  const [investValue, setInvestValue] = useState<number>(1);
  const [showExpirationPicker, setShowExpirationPicker] = useState(false);
  const [showAmountQuickPicker, setShowAmountQuickPicker] = useState(false);

  // Actual dollar amount to trade
  const actualAmount = useMemo(() => {
    if (investMode === '%') {
      const computed = (userBalance * investValue) / 100;
      return Math.max(1, Math.min(computed, userBalance));
    }
    return Math.max(1, Math.min(investValue, userBalance));
  }, [investMode, investValue, userBalance]);

  // Profit calculation
  const profitAmount = actualAmount * (asset.payoutPercent / 100);

  const handleButtonClick = (direction: TradeDirection) => {
    if (actualAmount <= 0) return;
    playClickSound();
    onInitiateTrade(direction, actualAmount, durationSeconds);
  };

  const handleToggleInvestMode = () => {
    playClickSound();
    setInvestMode((prev) => (prev === '$' ? '%' : '$'));
  };

  const expirationOptions = [
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '2m', value: 120 },
    { label: '5m', value: 300 },
  ];

  // Format current expiration clock
  const now = new Date();
  const expireDate = new Date(now.getTime() + durationSeconds * 1000);
  const formattedTime = `${expireDate.getHours().toString().padStart(2, '0')}:${expireDate.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-3.5 pt-2 pb-3.5 shadow-xs select-none relative z-20">
      {/* Row 1: Investment & Expiration Inputs */}
      <div className="grid grid-cols-2 gap-2.5 mb-2">
        {/* Investments Input Box */}
        <div className="relative">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1 px-0.5">
            <span>Investments</span>
            {/* Two small arrows toggle button between $ and % */}
            <button
              onClick={handleToggleInvestMode}
              className="text-slate-500 hover:text-indigo-600 flex items-center gap-0.5 text-[11px] font-bold transition-colors cursor-pointer bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-md"
              title="Click to toggle between $ and % investment"
            >
              <ArrowUpDown className="w-3 h-3 text-[#6366f1]" />
              <span className="font-mono-numbers text-indigo-600 font-black">{investMode}</span>
            </button>
          </div>

          <div className="relative flex items-center bg-[#f1f5f9] rounded-xl border border-slate-200 overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <button
              onClick={() => {
                playClickSound();
                setInvestValue((prev) => Math.max(1, prev - 1));
              }}
              className="w-7 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              type="number"
              min="1"
              max={investMode === '%' ? 100 : 50000}
              value={investValue}
              onChange={(e) => setInvestValue(Math.max(1, Number(e.target.value) || 1))}
              className="w-full bg-transparent text-center font-extrabold text-base text-slate-800 focus:outline-hidden py-2 font-mono-numbers"
            />

            <span className="text-slate-400 font-bold text-sm pr-1">{investMode}</span>

            <button
              onClick={() => {
                playClickSound();
                setInvestValue((prev) => prev + 1);
              }}
              className="w-7 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {investMode === '%' && (
            <div className="text-[10px] text-slate-400 font-mono-numbers mt-0.5 px-1">
              ≈ ${actualAmount.toFixed(2)}
            </div>
          )}

          {/* Quick Amount Chooser popup */}
          {showAmountQuickPicker && (
            <div className="absolute bottom-full left-0 mb-1.5 w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 p-2 z-30 grid grid-cols-4 gap-1 text-center font-mono-numbers text-xs font-bold text-slate-700 animate-in fade-in duration-100">
              {[1, 5, 10, 25, 50, 100, 250, 500].map((val) => (
                <button
                  key={val}
                  onClick={() => {
                    playClickSound();
                    setInvestValue(val);
                    setShowAmountQuickPicker(false);
                  }}
                  className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                    investValue === val
                      ? 'bg-[#6366f1] text-white border-[#6366f1]'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expiration Input Box */}
        <div className="relative">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1 px-0.5">
            <span>Expiration</span>
            {/* Pending trade toggle button (Opens PendingTradeModal) */}
            <button
              onClick={() => {
                playClickSound();
                onOpenPendingTrade?.();
              }}
              className="flex items-center gap-1 hover:text-slate-700 cursor-pointer"
            >
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5 text-indigo-500" />
                Pending trade
              </span>
              <div className="w-6 h-3.5 rounded-full bg-slate-300 relative flex items-center px-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              </div>
            </button>
          </div>

          <button
            onClick={() => {
              playClickSound();
              setShowExpirationPicker(!showExpirationPicker);
            }}
            className="w-full flex items-center justify-between bg-[#f1f5f9] rounded-xl border border-slate-200 px-3 py-2 text-slate-800 font-bold text-base font-mono-numbers hover:border-slate-300 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>{formattedTime}</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </button>

          {/* Expiration Picker Dropdown */}
          {showExpirationPicker && (
            <div className="absolute bottom-full right-0 mb-1.5 w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 p-2 z-30 flex flex-col gap-1 text-xs font-semibold animate-in fade-in duration-100">
              <div className="text-[10px] text-slate-400 px-1 py-0.5 font-bold uppercase">
                Trade Expiry
              </div>
              {expirationOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    playClickSound();
                    setDurationSeconds(opt.value);
                    setShowExpirationPicker(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    durationSeconds === opt.value
                      ? 'bg-indigo-50 text-indigo-600 font-bold'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="font-mono-numbers text-[11px] text-slate-400">
                    +{opt.value}s
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Profit Line */}
      <div className="flex items-center justify-between text-xs font-semibold px-1 mb-2.5">
        <div className="text-emerald-600 font-bold">
          Profit: <span className="font-mono-numbers">+{asset.payoutPercent}%</span>
        </div>
        <div className="text-emerald-600 font-mono-numbers font-bold text-sm">
          +${profitAmount.toFixed(2)}
        </div>
      </div>

      {/* Row 3: Action Buttons (LOWER & HIGHER) */}
      <div className="grid grid-cols-2 gap-3">
        {/* LOWER (Red) */}
        <button
          onClick={() => handleButtonClick('LOWER')}
          className="group relative flex items-center justify-between bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] active:scale-[0.97] text-white px-4 py-3 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-red-500/25 transition-all cursor-pointer overflow-hidden border border-red-400/30"
        >
          <div className="flex flex-col text-left">
            <span className="tracking-wider text-sm font-black drop-shadow-xs">LOWER</span>
            <span className="text-[10px] font-mono-numbers font-bold text-red-100 opacity-90">
              ${actualAmount.toFixed(0)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner group-hover:scale-105 transition-transform">
            <span className="text-lg font-black leading-none">↘</span>
          </div>
        </button>

        {/* HIGHER (Green) */}
        <button
          onClick={() => handleButtonClick('HIGHER')}
          className="group relative flex items-center justify-between bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] active:scale-[0.97] text-white px-4 py-3 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all cursor-pointer overflow-hidden border border-emerald-400/30"
        >
          <div className="flex flex-col text-left">
            <span className="tracking-wider text-sm font-black drop-shadow-xs">HIGHER</span>
            <span className="text-[10px] font-mono-numbers font-bold text-emerald-100 opacity-90">
              +${profitAmount.toFixed(2)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner group-hover:scale-105 transition-transform">
            <span className="text-lg font-black leading-none">↗</span>
          </div>
        </button>
      </div>
    </div>
  );
};
