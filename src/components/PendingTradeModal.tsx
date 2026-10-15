import React, { useState, useMemo } from 'react';
import { Asset, TradeDirection } from '../types/trading';
import { TrendingUp, Clock, Minus, Plus, X } from 'lucide-react';
import { playClickSound } from '../utils/audio';

interface PendingTradeModalProps {
  asset: Asset;
  currentPrice: number;
  userBalance: number;
  onPlacePendingTrade: (order: {
    type: 'BY_PRICE' | 'BY_TIME';
    direction: TradeDirection;
    amount: number;
    durationSeconds: number;
    targetPrice?: number;
    openTime?: number;
  }) => void;
  onClose: () => void;
}

export const PendingTradeModal: React.FC<PendingTradeModalProps> = ({
  asset,
  currentPrice,
  userBalance,
  onPlacePendingTrade,
  onClose,
}) => {
  const [tab, setTab] = useState<'BY_PRICE' | 'BY_TIME'>('BY_TIME');
  const priceStep = Math.pow(10, -asset.decimals);

  // By Price state
  const [targetPrice, setTargetPrice] = useState<number>(() => {
    return Number((currentPrice - priceStep * 5).toFixed(asset.decimals));
  });
  const [expirationMinutes, setExpirationMinutes] = useState<number>(1);

  // By Time state
  const [openOffsetMinutes, setOpenOffsetMinutes] = useState<number>(1);
  const [selectedQuickOffset, setSelectedQuickOffset] = useState<number>(1);

  // Investment state ($ vs %)
  const [investMode, setInvestMode] = useState<'$' | '%'>('%');
  const [investValue, setInvestValue] = useState<number>(1);

  // Derived investment dollar amount
  const calculatedAmount = useMemo(() => {
    if (investMode === '%') {
      const amt = (userBalance * investValue) / 100;
      return Math.max(1, Math.min(amt, userBalance));
    }
    return Math.max(1, Math.min(investValue, userBalance));
  }, [investMode, investValue, userBalance]);

  const profitAmount = (calculatedAmount * (asset.payoutPercent / 100)).toFixed(2);

  // Price difference badge for BY_PRICE
  const priceDiff = targetPrice - currentPrice;
  const isDiffPositive = priceDiff >= 0;
  const diffStr = Math.abs(priceDiff).toFixed(asset.decimals);

  // Calculated open & expire times for BY_TIME
  const now = new Date();
  const openDate = new Date(now.getTime() + openOffsetMinutes * 60 * 1000);
  const openTimeFormatted = `${openDate.getHours().toString().padStart(2, '0')}:${openDate.getMinutes().toString().padStart(2, '0')}`;

  const expireDate = new Date(openDate.getTime() + expirationMinutes * 60 * 1000);
  const expireTimeFormatted = `${expireDate.getHours().toString().padStart(2, '0')}:${expireDate.getMinutes().toString().padStart(2, '0')}`;

  const handleAction = (direction: TradeDirection) => {
    playClickSound();
    if (tab === 'BY_PRICE') {
      onPlacePendingTrade({
        type: 'BY_PRICE',
        direction,
        amount: calculatedAmount,
        durationSeconds: expirationMinutes * 60,
        targetPrice,
      });
    } else {
      onPlacePendingTrade({
        type: 'BY_TIME',
        direction,
        amount: calculatedAmount,
        durationSeconds: expirationMinutes * 60,
        openTime: openDate.getTime(),
      });
    }
    onClose();
  };

  const quickMinutes = [
    { label: '+1m', val: 1 },
    { label: '+2m', val: 2 },
    { label: '+3m', val: 3 },
    { label: '+5m', val: 5 },
    { label: '+10m', val: 10 },
    { label: '+15m', val: 15 },
    { label: '+30m', val: 30 },
    { label: '+60m', val: 60 },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-2xl rounded-t-3xl shadow-2xl border-t border-slate-200/90 p-4 pb-6 animate-in slide-in-from-bottom-6 duration-200 relative overflow-hidden"
      >
        {/* Top drag pill handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

        {/* Top Header Tabs: BY PRICE / BY TIME (Screenshots 9 & 10) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
          <button
            onClick={() => {
              playClickSound();
              setTab('BY_PRICE');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer ${
              tab === 'BY_PRICE'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>BY PRICE</span>
          </button>

          <button
            onClick={() => {
              playClickSound();
              setTab('BY_TIME');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer ${
              tab === 'BY_TIME'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>BY TIME</span>
          </button>
        </div>

        {/* TAB CONTENT: BY PRICE */}
        {tab === 'BY_PRICE' && (
          <div className="space-y-3.5 animate-in fade-in duration-100">
            {/* Target Price Section */}
            <div>
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  TARGET PRICE
                </span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md font-mono-numbers ${
                    isDiffPositive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {isDiffPositive ? `▲ ${diffStr}` : `▼ ${diffStr}`}
                </span>
              </div>

              {/* Stepper Input */}
              <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
                <button
                  onClick={() => {
                    playClickSound();
                    setTargetPrice((p) => Number((p - priceStep).toFixed(asset.decimals)));
                  }}
                  className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={targetPrice.toFixed(asset.decimals)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setTargetPrice(val);
                  }}
                  className="w-full bg-transparent text-center font-black text-xl text-slate-900 focus:outline-hidden font-mono-numbers py-2"
                />
                <button
                  onClick={() => {
                    playClickSound();
                    setTargetPrice((p) => Number((p + priceStep).toFixed(asset.decimals)));
                  }}
                  className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[11px] text-slate-400 font-mono-numbers mt-1 px-1">
                Current quote: <span className="font-bold text-slate-600">{currentPrice.toFixed(asset.decimals)}</span>
              </div>
            </div>

            {/* Expiration Section */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1 px-1">
                Expiration
              </span>
              <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => {
                    playClickSound();
                    setExpirationMinutes((m) => Math.max(1, m - 1));
                  }}
                  className="w-12 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center font-black text-base text-slate-800 font-mono-numbers">
                  {expirationMinutes} min
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    setExpirationMinutes((m) => Math.min(60, m + 1));
                  }}
                  className="w-12 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 px-1">
                after trigger · <span className="text-indigo-600 font-bold">SWITCH TIME</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: BY TIME */}
        {tab === 'BY_TIME' && (
          <div className="space-y-3.5 animate-in fade-in duration-100">
            {/* Opens At Section */}
            <div>
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  OPENS AT
                </span>
                <span className="text-[11px] font-bold text-indigo-600 font-mono-numbers">
                  in {openOffsetMinutes}:00
                </span>
              </div>

              {/* Stepper for open time */}
              <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => {
                    playClickSound();
                    setOpenOffsetMinutes((m) => Math.max(1, m - 1));
                  }}
                  className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center font-black text-2xl text-slate-900 font-mono-numbers tracking-tight">
                  {openTimeFormatted}
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    setOpenOffsetMinutes((m) => m + 1);
                  }}
                  className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* 8 Quick Increment Chips (Screenshot 9) */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {quickMinutes.slice(0, 4).map((q) => (
                  <button
                    key={q.val}
                    onClick={() => {
                      playClickSound();
                      setOpenOffsetMinutes(q.val);
                      setSelectedQuickOffset(q.val);
                    }}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      openOffsetMinutes === q.val
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {quickMinutes.slice(4).map((q) => (
                  <button
                    key={q.val}
                    onClick={() => {
                      playClickSound();
                      setOpenOffsetMinutes(q.val);
                      setSelectedQuickOffset(q.val);
                    }}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      openOffsetMinutes === q.val
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expires At Section */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1 px-1">
                Expires at
              </span>
              <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => {
                    playClickSound();
                    setExpirationMinutes((m) => Math.max(1, m - 1));
                  }}
                  className="w-12 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center font-black text-base text-slate-800 font-mono-numbers">
                  {expireTimeFormatted}
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    setExpirationMinutes((m) => Math.min(60, m + 1));
                  }}
                  className="w-12 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 px-1">
                {expirationMinutes} min after open · <span className="text-indigo-600 font-bold">SWITCH TIME</span>
              </div>
            </div>
          </div>
        )}

        {/* Investments Row ($100.06 SWITCH [-] % 1 [+]) (Screenshots 9 & 10) */}
        <div className="mt-3.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Investments
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono-numbers font-bold text-slate-700">
                ${calculatedAmount.toFixed(2)}
              </span>
              <button
                onClick={() => {
                  playClickSound();
                  setInvestMode(investMode === '%' ? '$' : '%');
                }}
                className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-700 underline cursor-pointer"
              >
                SWITCH
              </button>
            </div>
          </div>

          <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => {
                playClickSound();
                setInvestValue((v) => Math.max(1, v - 1));
              }}
              className="w-12 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 flex items-center justify-center gap-1 font-mono-numbers font-black text-base text-slate-900">
              <span className="text-slate-400 font-bold">{investMode}</span>
              <input
                type="number"
                min="1"
                max={investMode === '%' ? 100 : userBalance}
                value={investValue}
                onChange={(e) => setInvestValue(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 bg-transparent text-center font-black focus:outline-hidden"
              />
            </div>
            <button
              onClick={() => {
                playClickSound();
                setInvestValue((v) => v + 1);
              }}
              className="w-12 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Profit Line */}
        <div className="flex items-center justify-between text-xs font-semibold px-1 mt-2.5 mb-3">
          <div className="text-emerald-600 font-bold">
            Profit: <span className="font-mono-numbers">+{asset.payoutPercent}%</span>
          </div>
          <div className="text-emerald-600 font-mono-numbers font-bold text-sm">
            +${profitAmount}
          </div>
        </div>

        {/* Action Buttons: LOWER (Red) & HIGHER (Green) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAction('LOWER')}
            className="flex items-center justify-between bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] active:scale-[0.98] text-white px-4 py-3 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-red-500/25 transition-all cursor-pointer border border-red-400/30"
          >
            <span className="tracking-wider text-sm font-black">LOWER</span>
            <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <span className="text-base font-black">↘</span>
            </div>
          </button>

          <button
            onClick={() => handleAction('HIGHER')}
            className="flex items-center justify-between bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] active:scale-[0.98] text-white px-4 py-3 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all cursor-pointer border border-emerald-400/30"
          >
            <span className="tracking-wider text-sm font-black">HIGHER</span>
            <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <span className="text-base font-black">↗</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
