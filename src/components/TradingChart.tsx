import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Asset, Candle, TradeOrder, PendingTradeOrder } from '../types/trading';
import {
  Menu,
  X,
  Plus,
  Minus,
  RotateCcw,
  TrendingUp,
  BarChart2,
  Layers,
  Edit3,
  MessageSquare,
  Info,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { playClickSound } from '../utils/audio';

interface TradingChartProps {
  asset: Asset;
  candles: Candle[];
  currentPrice: number;
  openTrades: TradeOrder[];
  pendingTrades?: PendingTradeOrder[];
  closedTrades?: TradeOrder[];
  inspectedTrade?: TradeOrder | null;
  onSelectTrade?: (trade: TradeOrder | null) => void;
  timeframeSeconds: number;
  setTimeframeSeconds: (seconds: number) => void;
  countdownSeconds: number;
  onOpenAssetInfo?: () => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  asset,
  candles,
  currentPrice,
  openTrades,
  pendingTrades = [],
  closedTrades = [],
  inspectedTrade,
  onSelectTrade,
  timeframeSeconds,
  setTimeframeSeconds,
  countdownSeconds,
  onOpenAssetInfo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 380, height: 420 });

  // Chart configuration
  const [chartType, setChartType] = useState<'candles' | 'area' | 'line'>('candles');
  const [showToolsToolbar, setShowToolsToolbar] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<'none' | 'type' | 'timeframe' | 'indicators' | 'drawings'>('none');

  // "pahla se indicator na laga ho": FALSE by default!
  const [showIndicators, setShowIndicators] = useState(false);
  const [indicatorType, setIndicatorType] = useState<'sma' | 'ema' | 'bollinger'>('sma');

  // Fluctuating sentiment (matching screenshots e.g. 48% / 52% or 72% / 28%)
  const [sentimentBuy, setSentimentBuy] = useState(72);

  // Pan & Zoom state ("aur trade chart aga picha zoom nahi horaha fix")
  const [visibleCount, setVisibleCount] = useState<number>(26); // default 26 candles visible
  const [panOffset, setPanOffset] = useState<number>(0); // 0 = viewing latest candles, >0 = viewing history

  // Drag interaction refs
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPanOffsetRef = useRef(0);
  const touchDistanceRef = useRef<number | null>(null);

  // Measure container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 380,
          height: containerRef.current.clientHeight || 420,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Fluctuating sentiment bar
  useEffect(() => {
    const timer = setInterval(() => {
      setSentimentBuy((prev) => {
        const delta = (Math.random() - 0.5) * 4;
        return Math.min(85, Math.max(15, Math.round(prev + delta)));
      });
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // When inspectedTrade changes from trade history, center it in the chart view
  useEffect(() => {
    if (inspectedTrade && candles.length > 0) {
      const tradeTime = inspectedTrade.startTime;
      const targetIdx = candles.findIndex(
        (c) => Math.abs(c.time - tradeTime) <= timeframeSeconds * 2500
      );
      if (targetIdx !== -1) {
        const offset = Math.max(0, candles.length - targetIdx - Math.floor(visibleCount / 2));
        setPanOffset(offset);
      }
    }
  }, [inspectedTrade, candles, timeframeSeconds, visibleCount]);

  // Sliced candles based on pan & zoom
  const visibleCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const total = candles.length;
    const end = Math.max(visibleCount, total - panOffset);
    const start = Math.max(0, end - visibleCount);
    return candles.slice(start, end);
  }, [candles, visibleCount, panOffset]);

  // Price bounds calculation based on visible window
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!visibleCandles || visibleCandles.length === 0) {
      return {
        minPrice: currentPrice * 0.9995,
        maxPrice: currentPrice * 1.0005,
        priceRange: currentPrice * 0.001,
      };
    }
    let min = Math.min(...visibleCandles.map((c) => c.low));
    let max = Math.max(...visibleCandles.map((c) => c.high));

    // If live candle is in view (panOffset === 0), include currentPrice
    if (panOffset === 0) {
      min = Math.min(min, currentPrice);
      max = Math.max(max, currentPrice);
    }

    // Add 18% breathing room top and bottom
    const diff = max - min || currentPrice * 0.0006;
    min -= diff * 0.18;
    max += diff * 0.18;
    return { minPrice: min, maxPrice: max, priceRange: max - min };
  }, [visibleCandles, currentPrice, panOffset]);

  // Geometry
  const chartWidth = Math.max(260, dimensions.width - 66); // right axis margin
  const chartHeight = Math.max(200, dimensions.height - 30); // bottom time scale margin

  const priceToY = useCallback(
    (price: number) => {
      if (priceRange <= 0) return chartHeight / 2;
      return chartHeight - ((price - minPrice) / priceRange) * chartHeight;
    },
    [priceRange, minPrice, chartHeight]
  );

  const candleSpacing =
    visibleCandles.length > 1
      ? (chartWidth - 45) / Math.max(visibleCandles.length - 1, 1)
      : 20;
  const candleBodyWidth = Math.max(5, Math.min(22, candleSpacing * 0.72));

  // Current price position
  const currentY = priceToY(currentPrice);

  // Indicators: SMA
  const smaPoints = useMemo(() => {
    if (!showIndicators || candles.length < 5 || visibleCandles.length === 0) return '';
    const points: string[] = [];
    const period = 7;

    for (let i = 0; i < visibleCandles.length; i++) {
      const candle = visibleCandles[i];
      const globalIdx = candles.findIndex((c) => c.time === candle.time);
      if (globalIdx < period - 1) continue;

      const slice = candles.slice(globalIdx - period + 1, globalIdx + 1);
      const avg = slice.reduce((acc, c) => acc + c.close, 0) / period;
      const x = i * candleSpacing + 20;
      const y = priceToY(avg);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }, [candles, visibleCandles, candleSpacing, priceToY, showIndicators]);

  // Area & Line chart path
  const areaData = useMemo(() => {
    if (visibleCandles.length === 0) return { line: '', area: '' };
    const points = visibleCandles.map((c, i) => {
      const x = i * candleSpacing + 20;
      const y = priceToY(c.close);
      return `${x},${y}`;
    });

    const lastX = (visibleCandles.length - 1) * candleSpacing + 20;
    if (panOffset === 0) {
      points.push(`${lastX + 10},${currentY}`);
    }

    const line = `M ${points.join(' L ')}`;
    const area = `${line} L ${lastX + (panOffset === 0 ? 10 : 0)},${chartHeight} L 20,${chartHeight} Z`;
    return { line, area };
  }, [visibleCandles, candleSpacing, currentY, chartHeight, priceToY, panOffset]);

  // Price scale ticks
  const priceTicks = useMemo(() => {
    const ticks = [];
    const count = 7;
    for (let i = 0; i <= count; i++) {
      const price = minPrice + (priceRange * i) / count;
      const y = priceToY(price);
      ticks.push({ price, y });
    }
    return ticks;
  }, [minPrice, priceRange, priceToY]);

  // Countdown timer format
  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const endOfTradeX = Math.min(chartWidth - 25, (visibleCandles.length - 1) * candleSpacing + 45);
  const startOfTradeX = Math.max(30, endOfTradeX - 90);

  // Mouse & Touch Pan / Zoom Handlers ("aga picha zoom nahi horaha fix")
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startPanOffsetRef.current = panOffset;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    const candleShift = Math.round(deltaX / candleSpacing);
    const maxOffset = Math.max(0, candles.length - visibleCount);
    const newOffset = Math.max(0, Math.min(maxOffset, startPanOffsetRef.current + candleShift));
    setPanOffset(newOffset);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom in (fewer candles)
      setVisibleCount((prev) => Math.max(12, prev - 2));
    } else {
      // Zoom out (more candles)
      setVisibleCount((prev) => Math.min(80, Math.min(candles.length, prev + 2)));
    }
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      startXRef.current = e.touches[0].clientX;
      startPanOffsetRef.current = panOffset;
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const deltaX = e.touches[0].clientX - startXRef.current;
      const candleShift = Math.round(deltaX / candleSpacing);
      const maxOffset = Math.max(0, candles.length - visibleCount);
      const newOffset = Math.max(0, Math.min(maxOffset, startPanOffsetRef.current + candleShift));
      setPanOffset(newOffset);
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = newDist - touchDistanceRef.current;
      if (Math.abs(diff) > 15) {
        if (diff > 0) {
          // Pinch open = zoom in
          setVisibleCount((prev) => Math.max(12, prev - 1));
        } else {
          // Pinch close = zoom out
          setVisibleCount((prev) => Math.min(80, Math.min(candles.length, prev + 1)));
        }
        touchDistanceRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchDistanceRef.current = null;
  };

  // Reset to live candles
  const handleResetToLive = () => {
    playClickSound();
    setPanOffset(0);
    onSelectTrade?.(null);
  };

  // Zoom helpers
  const handleZoomIn = () => {
    playClickSound();
    setVisibleCount((prev) => Math.max(12, prev - 4));
  };

  const handleZoomOut = () => {
    playClickSound();
    setVisibleCount((prev) => Math.min(80, Math.min(candles.length, prev + 4)));
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className="relative w-full h-full bg-white select-none overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
    >
      {/* 1. LEFT SENTIMENT GAUGE (Screenshot 4 & 7: 72% green / 28% red) */}
      <div className="absolute left-1.5 top-6 bottom-7 w-1 flex flex-col z-20 pointer-events-none">
        <span className="text-[10px] font-bold text-emerald-600 mb-1 -ml-0.5">
          {sentimentBuy}%
        </span>
        <div className="flex-1 w-1 bg-slate-100 rounded-full flex flex-col overflow-hidden">
          <div
            className="bg-[#26a69a] rounded-t-full transition-all duration-700"
            style={{ height: `${sentimentBuy}%` }}
          />
          <div
            className="bg-[#ef5350] rounded-b-full transition-all duration-700"
            style={{ height: `${100 - sentimentBuy}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-red-500 mt-1 -ml-0.5">
          {100 - sentimentBuy}%
        </span>
      </div>

      {/* 2. TOP CHART HEADER INFO BAR WITH "(i)" BUTTON (Screenshot 4: "(i) ● 12:30:43 GMT+5 Beginning of trade") */}
      <div className="absolute top-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400 z-20 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          {/* "(i)" Info Button - Placed directly below top header on the chart as requested */}
          <button
            onClick={() => {
              playClickSound();
              onOpenAssetInfo?.();
            }}
            className="w-5 h-5 rounded-full border border-slate-300 bg-white/90 text-slate-600 hover:text-indigo-600 flex items-center justify-center text-[11px] font-serif font-black shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Asset Information & Trading Conditions"
          >
            i
          </button>

          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-mono-numbers text-slate-700 font-bold">12:30:43</span>
          <span className="text-[10px] text-slate-400">GMT+5 »</span>
          <span className="hidden sm:inline text-slate-400 text-[10px]">Beginning of trade</span>
        </div>

        <div className="flex items-center gap-1 text-slate-500">
          <span className="text-[10px] text-slate-400">« End of trade</span>
          <span className="font-mono-numbers font-bold text-slate-700">
            {formatCountdown(countdownSeconds)}
          </span>
        </div>
      </div>

      {/* 3. Floating Inspected Trade Banner (When clicked from Trade History) */}
      {inspectedTrade && (
        <div className="absolute top-9 left-3 right-3 z-30 flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl text-white shadow-xl border border-slate-700/60 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 overflow-hidden text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                inspectedTrade.status === 'WON'
                  ? 'bg-emerald-400 animate-pulse'
                  : inspectedTrade.status === 'LOST'
                  ? 'bg-red-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-black">{inspectedTrade.assetSymbol}</span>
            <span
              className={`font-black px-1.5 py-0.5 rounded-md text-[10px] ${
                inspectedTrade.direction === 'HIGHER'
                  ? 'bg-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/30 text-red-300'
              }`}
            >
              {inspectedTrade.direction === 'HIGHER' ? '↗ HIGHER' : '↘ LOWER'} ${inspectedTrade.amount}
            </span>
            <span className="font-mono-numbers text-[11px] text-slate-300">
              Entry: {inspectedTrade.entryPrice.toFixed(asset.decimals)}
            </span>
            {inspectedTrade.status && (
              <span
                className={`font-mono-numbers font-black text-xs ${
                  inspectedTrade.status === 'WON' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {inspectedTrade.status === 'WON'
                  ? `+$${inspectedTrade.profit.toFixed(2)}`
                  : `-$${inspectedTrade.amount.toFixed(2)}`}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              playClickSound();
              onSelectTrade?.(null);
            }}
            className="ml-2 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            Close ✕
          </button>
        </div>
      )}

      {/* 4. MAIN SVG CHART CANVAS */}
      <svg className="w-full flex-1" style={{ height: chartHeight + 28 }}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26a69a" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#26a69a" stopOpacity="0.0" />
          </linearGradient>

          <pattern id="gridPattern" width="45" height="45" patternUnits="userSpaceOnUse">
            <path d="M 45 0 L 0 0 0 45" fill="none" stroke="#f8fafc" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={chartWidth} height={chartHeight} fill="url(#gridPattern)" />

        {/* Horizontal grid lines */}
        {priceTicks.map((tick, idx) => (
          <line
            key={idx}
            x1="20"
            y1={tick.y}
            x2={chartWidth}
            y2={tick.y}
            stroke="#f1f5f9"
            strokeDasharray="2,2"
            strokeWidth="1"
          />
        ))}

        {/* Vertical Beginning of Trade dotted line */}
        <line
          x1={startOfTradeX}
          y1="8"
          x2={startOfTradeX}
          y2={chartHeight}
          stroke="#cbd5e1"
          strokeDasharray="3,3"
          strokeWidth="1.2"
        />

        {/* Vertical End of Trade red dotted line (Screenshots 4 & 5) */}
        <line
          x1={endOfTradeX}
          y1="8"
          x2={endOfTradeX}
          y2={chartHeight}
          stroke="#ef5350"
          strokeDasharray="3,3"
          strokeWidth="1.5"
        />

        {/* SMA Indicator (Only when toggled by user, NOT on by default) */}
        {showIndicators && smaPoints && (
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="3,3"
            points={smaPoints}
            opacity="0.85"
          />
        )}

        {/* PENDING TRADES ON CHART (Dashed line at target price) */}
        {pendingTrades
          .filter((pt) => pt.assetId === asset.id && pt.status === 'PENDING' && pt.targetPrice)
          .map((pt) => {
            const ptY = priceToY(pt.targetPrice!);
            return (
              <g key={pt.id}>
                <line
                  x1="20"
                  y1={ptY}
                  x2={chartWidth}
                  y2={ptY}
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />
                <rect
                  x={chartWidth - 95}
                  y={ptY - 9}
                  width="90"
                  height="18"
                  rx="4"
                  fill="#6366f1"
                />
                <text
                  x={chartWidth - 50}
                  y={ptY + 4}
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                >
                  Pending {pt.targetPrice!.toFixed(asset.decimals)}
                </text>
              </g>
            );
          })}

        {/* CHART RENDER: Candlesticks / Area / Line */}
        {chartType === 'area' && areaData.line && (
          <>
            <path d={areaData.area} fill="url(#areaGradient)" />
            <path
              d={areaData.line}
              fill="none"
              stroke="#26a69a"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {chartType === 'line' && areaData.line && (
          <path
            d={areaData.line}
            fill="none"
            stroke="#26a69a"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {chartType === 'candles' && (
          <g>
            {visibleCandles.map((c, i) => {
              const x = i * candleSpacing + 20;
              const isBull = c.close >= c.open;
              const openY = priceToY(c.open);
              const closeY = priceToY(c.close);
              const highY = priceToY(c.high);
              const lowY = priceToY(c.low);

              const bodyY = Math.min(openY, closeY);
              const bodyHeight = Math.max(2, Math.abs(openY - closeY));
              // Authentic TradoWix candle colors: #26a69a (teal green) & #ef5350 (coral red)
              const color = isBull ? '#26a69a' : '#ef5350';

              return (
                <g key={c.time}>
                  {/* Top wick */}
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={bodyY}
                    stroke={color}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  {/* Bottom wick */}
                  <line
                    x1={x}
                    y1={bodyY + bodyHeight}
                    x2={x}
                    y2={lowY}
                    stroke={color}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  {/* Candle body */}
                  <rect
                    x={x - candleBodyWidth / 2}
                    y={bodyY}
                    width={candleBodyWidth}
                    height={bodyHeight}
                    fill={color}
                    rx="1.5"
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* 5. ACTIVE OPEN TRADES ON CHART: Authentic TradoWix Arrow & Step Line (Screenshots 11 & 13) */}
        {/* Continuously flowing SVG dashed line and payout card REMOVED per user requirement */}
        {openTrades.map((trade) => {
          const tradeY = priceToY(trade.entryPrice);
          const now = Date.now();
          const remainingSec = Math.max(0, Math.ceil((trade.expireTime - now) / 1000));
          const isHigher = trade.direction === 'HIGHER';

          // Candle index for trade entry
          const candleIdx = visibleCandles.findIndex(
            (c) => Math.abs(c.time - trade.startTime) < timeframeSeconds * 2000
          );
          const currentCandleX = (visibleCandles.length - 1) * candleSpacing + 20;
          const tradeEntryX =
            candleIdx !== -1
              ? candleIdx * candleSpacing + 20
              : Math.max(30, currentCandleX - 70);

          // Arrow and line colors (Green #10b981 for HIGHER, Red #ef4444 for LOWER)
          const tradeColor = isHigher ? '#10b981' : '#ef4444';

          return (
            <g
              key={trade.id}
              onClick={() => {
                playClickSound();
                onSelectTrade?.(trade);
              }}
              className="cursor-pointer"
            >
              {/* Clean solid horizontal step line at entry strike price */}
              <line
                x1={tradeEntryX}
                y1={tradeY}
                x2={currentCandleX}
                y2={tradeY}
                stroke={tradeColor}
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Entry pin hollow circle */}
              <circle
                cx={tradeEntryX}
                cy={tradeY}
                r="4.5"
                fill="#ffffff"
                stroke={tradeColor}
                strokeWidth="2.5"
              />

              {/* End of line pin circle */}
              <circle
                cx={currentCandleX}
                cy={tradeY}
                r="4"
                fill="#ffffff"
                stroke={tradeColor}
                strokeWidth="2"
              />

              {/* AUTHENTIC ARROW BADGE (Screenshots 11 & 13) */}
              {/* Green diagonal arrow ↗ for HIGHER, Red diagonal arrow ↘ for LOWER */}
              <g
                transform={`translate(${tradeEntryX + 10}, ${
                  isHigher ? tradeY - 32 : tradeY + 12
                })`}
              >
                {/* Rounded container with vibrant arrow */}
                <rect
                  width="26"
                  height="26"
                  rx="7"
                  fill={tradeColor}
                  filter="drop-shadow(0 2px 5px rgba(0,0,0,0.22))"
                />
                <text
                  x="13"
                  y="18"
                  fill="#ffffff"
                  fontSize="15"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  {isHigher ? '↗' : '↘'}
                </text>
              </g>

              {/* STRIKE LINE PILL (Screenshot 11 & 13: e.g. "↑ $1 00:25") */}
              <g
                transform={`translate(${tradeEntryX + 2}, ${
                  isHigher ? tradeY - 14 : tradeY + 4
                })`}
              >
                <rect
                  width="64"
                  height="16"
                  rx="4"
                  fill={tradeColor}
                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.18))"
                />
                <text
                  x="32"
                  y="11.5"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {isHigher ? '↑' : '↓'} ${trade.amount} 00:{remainingSec.toString().padStart(2, '0')}
                </text>
              </g>

              {/* Circular purple button with arrow pointing to expiry (Screenshot 4 & 7) */}
              <g transform={`translate(${Math.min(chartWidth - 45, tradeEntryX + 50)}, ${tradeY - 12})`}>
                <circle
                  cx="12"
                  cy="12"
                  r="12"
                  fill="#f1f5f9"
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.08))"
                />
                <text
                  x="12"
                  y="16"
                  fill="#6366f1"
                  fontSize="12"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  →
                </text>
              </g>
            </g>
          );
        })}

        {/* 6. INSPECTED TRADE FROM HISTORY (Clean view when tapping trade graph icon) */}
        {inspectedTrade && inspectedTrade.status && (
          <g key={`inspected-${inspectedTrade.id}`} className="z-20">
            {(() => {
              const entryY = priceToY(inspectedTrade.entryPrice);
              const exitY = priceToY(inspectedTrade.exitPrice || inspectedTrade.entryPrice);
              const isHigher = inspectedTrade.direction === 'HIGHER';
              const isWon = inspectedTrade.status === 'WON';
              const outcomeColor = isWon ? '#10b981' : '#ef4444';
              const tradeColor = isHigher ? '#10b981' : '#ef4444';

              const entryIdx = visibleCandles.findIndex(
                (c) => Math.abs(c.time - inspectedTrade.startTime) < timeframeSeconds * 2000
              );
              const exitIdx = visibleCandles.findIndex(
                (c) => Math.abs(c.time - inspectedTrade.expireTime) < timeframeSeconds * 2000
              );

              const entryX =
                entryIdx !== -1
                  ? entryIdx * candleSpacing + 20
                  : Math.max(30, chartWidth - 140);
              const exitX =
                exitIdx !== -1
                  ? exitIdx * candleSpacing + 20
                  : Math.min(chartWidth - 25, entryX + 70);

              return (
                <g>
                  {/* Strike level line across entry and exit */}
                  <line
                    x1={entryX}
                    y1={entryY}
                    x2={exitX}
                    y2={entryY}
                    stroke={tradeColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Vertical step to exit price */}
                  <line
                    x1={exitX}
                    y1={entryY}
                    x2={exitX}
                    y2={exitY}
                    stroke={outcomeColor}
                    strokeWidth="1.8"
                    strokeDasharray="3,3"
                  />

                  {/* Entry Pin Circle */}
                  <circle
                    cx={entryX}
                    cy={entryY}
                    r="4.5"
                    fill="#ffffff"
                    stroke={tradeColor}
                    strokeWidth="2.5"
                  />

                  {/* Exit Settlement Circle */}
                  <circle
                    cx={exitX}
                    cy={exitY}
                    r="5"
                    fill={outcomeColor}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />

                  {/* Direction Arrow Badge */}
                  <g transform={`translate(${entryX - 12}, ${isHigher ? entryY - 30 : entryY + 10})`}>
                    <rect
                      width="24"
                      height="24"
                      rx="6"
                      fill={tradeColor}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"
                    />
                    <text
                      x="12"
                      y="17"
                      fill="#ffffff"
                      fontSize="14"
                      fontWeight="900"
                      textAnchor="middle"
                    >
                      {isHigher ? '↗' : '↘'}
                    </text>
                  </g>

                  {/* Entry Strike Label */}
                  <g transform={`translate(${Math.max(5, entryX - 58)}, ${entryY - 9})`}>
                    <rect
                      width="46"
                      height="18"
                      rx="4"
                      fill="#ffffff"
                      stroke={tradeColor}
                      strokeWidth="1"
                    />
                    <text
                      x="23"
                      y="13"
                      fill="#0f172a"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {inspectedTrade.entryPrice.toFixed(asset.decimals)}
                    </text>
                  </g>

                  {/* Outcome Badge */}
                  <g transform={`translate(${Math.max(10, Math.min(chartWidth - 85, exitX - 40))}, ${exitY - 24})`}>
                    <rect
                      width="80"
                      height="20"
                      rx="5"
                      fill={outcomeColor}
                      filter="drop-shadow(0 2px 5px rgba(0,0,0,0.2))"
                    />
                    <text
                      x="40"
                      y="14"
                      fill="#ffffff"
                      fontSize="9.5"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {isWon ? `WON +$${inspectedTrade.profit.toFixed(2)}` : `LOST -$${inspectedTrade.amount.toFixed(2)}`}
                    </text>
                  </g>
                </g>
              );
            })()}
          </g>
        )}

        {/* Live Current Price Dotted Line (Screenshots 4 & 7) */}
        {panOffset === 0 && (
          <>
            <line
              x1="20"
              y1={currentY}
              x2={chartWidth + 6}
              y2={currentY}
              stroke="#26a69a"
              strokeDasharray="3,3"
              strokeWidth="1.8"
            />
            <circle
              cx={chartWidth}
              cy={currentY}
              r="4.5"
              fill="#26a69a"
              className="animate-pulse"
            />
          </>
        )}

        {/* Bottom Time labels */}
        {visibleCandles.map((c, i) => {
          if (i % 6 !== 0) return null;
          const x = i * candleSpacing + 20;
          const date = new Date(c.time);
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          return (
            <text
              key={`t-${c.time}`}
              x={x}
              y={chartHeight + 17}
              fill="#94a3b8"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
              textAnchor="middle"
            >
              {timeStr}
            </text>
          );
        })}
      </svg>

      {/* 7. RIGHT PRICE SCALE BAR */}
      <div
        className="absolute right-0 top-0 bottom-6 w-16 border-l border-slate-100 flex flex-col justify-between py-2 pointer-events-none"
        style={{ height: chartHeight }}
      >
        {priceTicks.map((tick, i) => (
          <div
            key={i}
            className="text-[10px] font-mono-numbers text-slate-400 pl-1.5 transition-all"
            style={{
              position: 'absolute',
              top: `${Math.max(4, Math.min(chartHeight - 16, tick.y - 7))}px`,
            }}
          >
            {tick.price.toFixed(asset.decimals)}
          </div>
        ))}

        {/* CURRENT LIVE PRICE BADGE WITH COUNTDOWN (Screenshots 4 & 7: teal box with countdown) */}
        {panOffset === 0 && (
          <div
            className="absolute right-0 z-30 flex flex-col items-center shadow-lg transition-transform duration-75"
            style={{
              top: `${Math.max(8, Math.min(chartHeight - 34, currentY - 18))}px`,
            }}
          >
            <div className="bg-[#26a69a] text-white px-2 py-0.5 rounded-l-md font-mono-numbers text-right shadow-sm border border-[#208a80]">
              <div className="text-[11px] font-bold tracking-tight leading-tight">
                {currentPrice.toFixed(asset.decimals)}
              </div>
              <div className="text-[10px] font-medium opacity-90 leading-tight">
                {formatCountdown(countdownSeconds)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 8. FLOATING LIVE RESET BUTTON (When user panned into history) */}
      {panOffset > 0 && (
        <button
          onClick={handleResetToLive}
          className="absolute right-20 bottom-3.5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg animate-in fade-in duration-150 cursor-pointer active:scale-95"
        >
          <span>⏩ Return to Live</span>
        </button>
      )}

      {/* 9. ZOOM IN / OUT CONTROLS */}
      <div className="absolute right-18 bottom-3.5 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-md rounded-xl border border-slate-200/80 p-0.5 shadow-xs">
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 10. AUTHENTIC 3-LINE CHART TOOLS MENU (Screenshot 12: 3 lines button -> vertical toolbar) */}
      {/* "aur jab hum trade chart ma 3 line ha wase show ho ok fix" */}
      <div className="absolute left-6 bottom-3 z-30">
        {!showToolsToolbar ? (
          <button
            onClick={() => {
              playClickSound();
              setShowToolsToolbar(true);
            }}
            className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 text-slate-700 hover:text-indigo-600 shadow-sm flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            title="Chart Tools Menu (3 lines)"
          >
            <Menu className="w-4 h-4" />
          </button>
        ) : (
          /* VERTICAL TOOLBAR STACK (Screenshot 12) */
          <div className="flex flex-col gap-1.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 p-1.5 animate-in slide-in-from-bottom-2 duration-150 z-30">
            {/* 1. Chart Type (Candles icon) */}
            <button
              onClick={() => {
                playClickSound();
                setActiveSubMenu(activeSubMenu === 'type' ? 'none' : 'type');
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                activeSubMenu === 'type'
                  ? 'bg-indigo-600 border-indigo-700 text-white'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
              title="Chart Style (Candles / Area / Line)"
            >
              <BarChart2 className="w-4 h-4" />
            </button>

            {/* 2. Timeframe (1m button) */}
            <button
              onClick={() => {
                playClickSound();
                setActiveSubMenu(activeSubMenu === 'timeframe' ? 'none' : 'timeframe');
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center font-mono-numbers font-black text-xs transition-all cursor-pointer ${
                activeSubMenu === 'timeframe'
                  ? 'bg-indigo-600 border-indigo-700 text-white'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
              title="Chart Timeframe"
            >
              {timeframeSeconds < 60 ? `${timeframeSeconds}s` : `${Math.floor(timeframeSeconds / 60)}m`}
            </button>

            {/* 3. Indicators (Wavy graph icon) */}
            <button
              onClick={() => {
                playClickSound();
                setActiveSubMenu(activeSubMenu === 'indicators' ? 'none' : 'indicators');
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                showIndicators || activeSubMenu === 'indicators'
                  ? 'bg-amber-500 border-amber-600 text-white'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
              title="Indicators"
            >
              <TrendingUp className="w-4 h-4" />
            </button>

            {/* 4. Drawing Tools (Pencil icon) */}
            <button
              onClick={() => {
                playClickSound();
                setActiveSubMenu(activeSubMenu === 'drawings' ? 'none' : 'drawings');
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                activeSubMenu === 'drawings'
                  ? 'bg-indigo-600 border-indigo-700 text-white'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
              title="Drawing Tools"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {/* 5. Undo / Reset Zoom */}
            <button
              onClick={() => {
                playClickSound();
                handleResetToLive();
                setVisibleCount(26);
              }}
              className="w-9 h-9 rounded-xl border border-transparent text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* 6. Close toolbar button */}
            <button
              onClick={() => {
                playClickSound();
                setShowToolsToolbar(false);
                setActiveSubMenu('none');
              }}
              className="w-9 h-9 rounded-xl border border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SUBMENU POPUPS (Glassmorphic) */}
        {/* Submenu: Chart Style */}
        {showToolsToolbar && activeSubMenu === 'type' && (
          <div className="absolute left-12 bottom-20 w-44 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/80 p-2 z-40 animate-in fade-in duration-100 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
              Chart Type
            </div>
            {[
              { id: 'candles', label: 'Candlesticks' },
              { id: 'area', label: 'Area Chart' },
              { id: 'line', label: 'Line Chart' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  playClickSound();
                  setChartType(t.id as any);
                  setActiveSubMenu('none');
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  chartType === t.id
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{t.label}</span>
                {chartType === t.id && <span className="text-indigo-600 font-black">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Submenu: Timeframes */}
        {showToolsToolbar && activeSubMenu === 'timeframe' && (
          <div className="absolute left-12 bottom-12 w-44 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/80 p-2 z-40 animate-in fade-in duration-100 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
              Candle Period
            </div>
            {[5, 10, 15, 30, 60, 300].map((sec) => (
              <button
                key={sec}
                onClick={() => {
                  playClickSound();
                  setTimeframeSeconds(sec);
                  setActiveSubMenu('none');
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  timeframeSeconds === sec
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{sec < 60 ? `${sec} seconds` : `${sec / 60} minute`}</span>
                {timeframeSeconds === sec && <span className="text-indigo-600 font-black">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Submenu: Indicators ("pahla se indicator na laga ho") */}
        {showToolsToolbar && activeSubMenu === 'indicators' && (
          <div className="absolute left-12 bottom-4 w-52 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/80 p-2.5 z-40 animate-in fade-in duration-100">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">Indicators</span>
              <span className="text-[10px] text-slate-400">Technical</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-1">
              <span className="text-xs font-bold text-slate-700">SMA (Period 7)</span>
              <input
                type="checkbox"
                checked={showIndicators}
                onChange={(e) => {
                  playClickSound();
                  setShowIndicators(e.target.checked);
                }}
                className="w-4 h-4 text-indigo-600 rounded-sm cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Submenu: Drawings */}
        {showToolsToolbar && activeSubMenu === 'drawings' && (
          <div className="absolute left-12 bottom-0 w-44 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/80 p-2 z-40 animate-in fade-in duration-100 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
              Drawing Tools
            </div>
            {['Horizontal Line', 'Trendline', 'Ray'].map((tool) => (
              <button
                key={tool}
                onClick={() => {
                  playClickSound();
                  setActiveSubMenu('none');
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {tool}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
