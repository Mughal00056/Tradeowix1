import React from 'react';
import { TradeOrder, Asset } from '../types/trading';
import { AssetIcon } from './AssetIcon';
import { X, RotateCcw, LineChart, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { playClickSound } from '../utils/audio';

interface TradesDrawerProps {
  openTrades: TradeOrder[];
  closedTrades: TradeOrder[];
  assets: Asset[];
  currentPrices: Record<string, number>;
  onClose: () => void;
  onSelectTrade?: (trade: TradeOrder) => void;
}

export const TradesDrawer: React.FC<TradesDrawerProps> = ({
  openTrades,
  closedTrades,
  assets,
  currentPrices,
  onClose,
  onSelectTrade,
}) => {
  const allDeals = [...openTrades, ...closedTrades];

  const handleInspectGraph = (trade: TradeOrder) => {
    playClickSound();
    onSelectTrade?.(trade);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-hidden"
    >
      {/* Full Sheet with authentic TradoWix Glass Styling (Screenshot 8) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-2xl rounded-t-3xl shadow-2xl border-t border-white/80 h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-200 relative"
      >
        {/* Soft pastel ambient background glow */}
        <div className="absolute top-0 right-10 w-72 h-72 bg-purple-100/40 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Header Bar matching Screenshot 8 */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200/60">
              <RotateCcw className="w-4 h-4 text-purple-600" />
            </div>
            <h1 className="text-base font-black text-slate-900 tracking-tight">
              Trades History
            </h1>
          </div>

          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtitle: Total Deals */}
        <div className="px-5 py-2.5 text-xs text-slate-400 font-bold border-b border-slate-100/60">
          Total Deals: <span className="font-mono-numbers text-slate-700">{allDeals.length}</span>
        </div>

        {/* Deals List matching Screenshot 8 */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 custom-scrollbar">
          {allDeals.length === 0 ? (
            <div className="py-20 text-center">
              <LineChart className="w-12 h-12 text-slate-300 mx-auto mb-2.5 stroke-1" />
              <p className="text-sm font-bold text-slate-600">No deals executed yet</p>
              <p className="text-xs text-slate-400 mt-1">Execute a trade on the chart to see history</p>
            </div>
          ) : (
            allDeals.map((deal) => {
              const assetObj = assets.find((a) => a.id === deal.assetId);
              const flags = assetObj ? assetObj.flags : (['eu', 'us'] as [string, string]);
              const date = new Date(deal.startTime);
              const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
              const isWon = deal.status === 'WON';
              const isOpen = deal.status === 'OPEN';
              const isHigher = deal.direction === 'HIGHER';

              // Format profit / return string
              const profitStr = isOpen
                ? `+$${((deal.amount * deal.payoutPercent) / 100).toFixed(2)}`
                : isWon
                ? `+$${deal.profit.toFixed(2)}`
                : `-$${deal.amount.toFixed(2)}`;

              return (
                <div
                  key={deal.id}
                  className="px-3 py-3 rounded-2xl bg-white/70 hover:bg-white/95 border border-slate-100 hover:border-indigo-200 transition-all flex items-center justify-between group shadow-2xs"
                >
                  {/* Left Column: Time & Asset Info */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono-numbers font-medium text-slate-400 w-10">
                      {timeStr}
                    </span>

                    <AssetIcon flags={flags} size="sm" />

                    <div>
                      <div className="font-extrabold text-sm text-slate-900 tracking-tight">
                        {deal.assetSymbol.replace(' (OTC)', '')}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        Blitz
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Profit, Amount, Arrow & Graph Icon */}
                  <div className="flex items-center gap-3.5">
                    <div className="text-right">
                      {/* Profit with dropdown arrow (Screenshot 8: +$0.81 ∨) */}
                      <div className="flex items-center justify-end gap-1">
                        <span
                          className={`font-mono-numbers font-extrabold text-sm ${
                            isOpen
                              ? 'text-emerald-600'
                              : isWon
                              ? 'text-emerald-600'
                              : 'text-red-500'
                          }`}
                        >
                          {profitStr}
                        </span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </div>

                      {/* Trade Amount and Direction Arrow */}
                      <div className="text-xs font-mono-numbers font-bold text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                        <span>${deal.amount.toFixed(2)}</span>
                        <span className={isHigher ? 'text-emerald-600 font-black' : 'text-red-500 font-black'}>
                          {isHigher ? '↗' : '↘'}
                        </span>
                      </div>
                    </div>

                    {/* DEDICATED GRAPH / CHART ICON BUTTON (Screenshot 8) */}
                    {/* "trade history ka sath graph nahi ha jab aus par tap kara tu jidr lagaya ha waha show kara jidr trade lagaya ha waha ok" */}
                    <button
                      onClick={() => handleInspectGraph(deal)}
                      className="w-9 h-9 rounded-xl bg-slate-100/80 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Show this trade on chart"
                    >
                      <LineChart className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
