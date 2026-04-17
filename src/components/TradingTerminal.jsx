'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Cpu, Activity, ShieldCheck, Zap, ArrowUp, ArrowDown, Target, ChevronDown, ChevronUp } from 'lucide-react';

export const TradingTerminal = React.forwardRef(({ schedule, creditPulse, creditMeta, t }, ref) => {
  const tt = t || {};
  const [price, setPrice] = useState(1.0542);
  const [history, setHistory] = useState(() => Array(40).fill(1.0542));
  const [ops, setOps] = useState([]);
  const [opsCount, setOpsCount] = useState(0);
  const [trend, setTrend] = useState('bull');
  const [lastCredit, setLastCredit] = useState(null);
  const [selectedExpiration, setSelectedExpiration] = useState('1m');
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [selectedAssetGroup, setSelectedAssetGroup] = useState('AUTO');
  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [panelOpen, setPanelOpen] = useState(false);
  const priceRef = useRef(1.0542);
  const trendRef = useRef('bull');
  const payoutPct = 83;

  const scheduleStatus = schedule?.status || 'idle';
  const totals = schedule?.totals || { totalCapital: 0, totalAccumulated: 0, profitToday: 0 };

  useEffect(() => {
    const interval = setInterval(() => {
      const volatility = 0.0005;
      const trendBias = trendRef.current === 'bull' ? 0.0002 : -0.0002;
      const change = priceRef.current * (volatility * (Math.random() - 0.5) + trendBias);
      const newPrice = priceRef.current + change;
      priceRef.current = newPrice;
      setPrice(newPrice);
      setHistory(prev => [...prev.slice(1), newPrice]);
      if (Math.random() < 0.05) {
        trendRef.current = trendRef.current === 'bull' ? 'bear' : 'bull';
        setTrend(trendRef.current);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getPairPool = (group) => {
    const fxPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/JPY', 'USD/CHF', 'AUD/CAD', 'NZD/USD'];
    const metalPairs = ['XAU/USD', 'XAG/USD'];
    const cryptoPairs = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD'];
    const allPairs = [...fxPairs, ...metalPairs, ...cryptoPairs];
    if (group === 'FX') return fxPairs;
    if (group === 'METALS') return metalPairs;
    if (group === 'CRYPTO') return cryptoPairs;
    return allPairs;
  };

  const pickRandomPair = (group) => {
    const pool = getPairPool(group);
    return pool[Math.floor(Math.random() * pool.length)] || 'EUR/USD';
  };

  useEffect(() => {
    setSelectedPair(pickRandomPair(selectedAssetGroup));
  }, [selectedAssetGroup]);

  const buildBinaryOp = () => {
    const pool = getPairPool(selectedAssetGroup);
    const safeSelected = selectedPair && pool.includes(selectedPair) ? selectedPair : null;
    const pair = safeSelected || pickRandomPair(selectedAssetGroup);
    const exchange = Math.random() > 0.5 ? 'CASATRADE' : 'EXNOVA';
    const direction = Math.random() > 0.5 ? 'HIGHER' : 'LOWER';
    const expiration = selectedExpiration === '5m' ? '5m' : '1m';
    const expirationMinutes = expiration === '5m' ? 5 : 1;
    const stake = Math.max(1, Number(selectedAmount) || 0);
    const pnl = (stake * payoutPct) / 100;
    const createdAt = Date.now();

    return {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt,
      exchange,
      pair,
      type: 'BINARY',
      direction,
      expiration,
      expirationMinutes,
      result: 'WIN',
      payoutPct,
      stake,
      pnl,
      time: new Date().toLocaleTimeString()
    };
  };

  useEffect(() => {
    if (!creditPulse || !creditMeta) return;
    setLastCredit(creditMeta);
    const op = buildBinaryOp();
    setSelectedPair(op.pair);
    setOps(prev => [op, ...prev.slice(0, 6)]);
    setOpsCount(c => c + 1);
  }, [creditPulse, creditMeta, selectedExpiration, selectedAmount, selectedAssetGroup]);

  const lastOp = ops[0] || null;
  const displayPair = lastOp?.pair || selectedPair || 'EUR/USD';

  const selectedExpirationMinutes = selectedExpiration === '5m' ? 5 : 1;
  const selectedExpirationAtNY = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() + selectedExpirationMinutes * 60_000);
  }, [selectedExpirationMinutes]);

  const formatTimeNY = (d) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  };

  const expirationAtNY = useMemo(() => {
    if (!lastOp?.createdAt || !lastOp?.expirationMinutes) return null;
    return new Date(Number(lastOp.createdAt) + Number(lastOp.expirationMinutes) * 60_000);
  }, [lastOp?.createdAt, lastOp?.expirationMinutes]);

  const chart = useMemo(() => {
    const width = 300;
    const height = 100;
    const padTop = 12;
    const padBottom = 8;
    const innerH = height - padTop - padBottom;

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = (max - min) || 1;
    const mapY = (p) => height - padBottom - ((p - min) / range) * innerH;

    const candleCount = 14;
    const segmentSize = Math.max(2, Math.floor(history.length / candleCount));
    const candles = [];
    for (let i = 0; i < candleCount; i++) {
      const start = i * segmentSize;
      const end = i === candleCount - 1 ? history.length : (i + 1) * segmentSize;
      const slice = history.slice(start, end);
      if (!slice.length) continue;
      const open = slice[0];
      const close = slice[slice.length - 1];
      let high = slice[0];
      let low = slice[0];
      for (let j = 1; j < slice.length; j++) {
        if (slice[j] > high) high = slice[j];
        if (slice[j] < low) low = slice[j];
      }
      candles.push({ open, close, high, low });
    }

    const gap = width / candleCount;
    const bodyW = Math.max(3, Math.min(10, gap * 0.65));
    const candleDraw = candles.map((c, i) => {
      const x = i * gap + gap / 2;
      const yOpen = mapY(c.open);
      const yClose = mapY(c.close);
      const yHigh = mapY(c.high);
      const yLow = mapY(c.low);
      const up = c.close >= c.open;
      const color = up ? '#4ade80' : '#f87171';
      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
      return {
        x,
        yOpen,
        yClose,
        yHigh,
        yLow,
        up,
        color,
        body: { x: x - bodyW / 2, y: bodyY, w: bodyW, h: bodyH }
      };
    });

    const expX = width * 0.88;
    const lastClose = candles.length ? candles[candles.length - 1].close : history[history.length - 1];
    const expY = mapY(lastClose);

    return { candleDraw, expX, expY };
  }, [history]);

  const statusInfo = useMemo(() => {
    if (scheduleStatus === 'ready') return { label: tt.terminalCreditAvailable || 'Crédito disponível', tone: 'text-green-400', dot: 'bg-green-400 animate-pulse' };
    if (scheduleStatus === 'waiting') return { label: (tt.terminalWaitingForCredit || 'Aguardando crédito') + ` ${schedule?.creditAt || '19:00'} ${tt.terminalWashington || 'Washington'}`, tone: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' };
    if (scheduleStatus === 'weekend') return { label: tt.terminalWeekendNoOps || 'Sem operações (fim de semana)', tone: 'text-gray-400', dot: 'bg-gray-500' };
    if (scheduleStatus === 'done') return { label: tt.terminalCredited || 'Trading creditado', tone: 'text-green-400', dot: 'bg-green-400' };
    return { label: tt.terminalPaused || 'Pausado', tone: 'text-gray-400', dot: 'bg-gray-500' };
  }, [scheduleStatus, schedule?.creditAt, tt.terminalCreditAvailable, tt.terminalWaitingForCredit, tt.terminalWashington, tt.terminalWeekendNoOps, tt.terminalCredited, tt.terminalPaused]);

  const dirLabel = (d) => {
    if (d === 'HIGHER') return tt.terminalHigher || 'HIGHER';
    if (d === 'LOWER') return tt.terminalLower || 'LOWER';
    return d || '—';
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-6 animate-fadeIn px-2 sm:px-4">
      <div className="bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-blue-500/30 shadow-[0_0_40px_rgba(37,99,235,0.15)] overflow-hidden relative">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 border-b border-gray-700 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40 animate-pulse"></div>
              <Cpu className="text-blue-400 relative z-10" size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-black font-mono text-[11px] sm:text-sm tracking-wider leading-tight uppercase">
                <span className="hidden sm:inline">{tt.terminalEngineTitle || 'VDEX BINARY ENGINE'}</span>
                <span className="sm:hidden">VDEX BINARY<br />ENGINE</span>
              </h3>
              <p className={`text-[10px] font-mono flex items-start gap-1 ${statusInfo.tone} leading-tight max-w-[260px] sm:max-w-none`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                <span className="break-words">{statusInfo.label}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end text-right flex-shrink-0">
            <span className="text-[10px] text-gray-500 font-mono mb-1">{tt.terminalCredit || 'Crédito'}</span>
            <div className="bg-gray-800 border border-gray-600 rounded px-2 py-1 flex items-center gap-2 whitespace-nowrap">
              <Target size={12} className="text-yellow-400" />
              <span className="text-xs font-mono font-bold text-white">
                {schedule?.creditAt || '19:00'} WSH
              </span>
            </div>
            {!!schedule?.weekdayLabel && !!schedule?.dateLabel && (
              <span className="mt-2 text-[10px] font-mono text-gray-400 leading-tight">
                {schedule.weekdayLabel} <span className="text-gray-500">{schedule.dateLabel}</span> <span className="text-yellow-300">{schedule?.washingtonTime}</span>
              </span>
            )}
            {lastCredit?.creditedCount > 0 && (
              <span className="mt-2 text-[10px] font-mono bg-green-600/15 text-green-300 px-2 py-1 rounded">
                +${Number(lastCredit.totalProfit || 0).toFixed(4)} {tt.terminalCreditedSuffix || 'creditados'}
              </span>
            )}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-400 text-[10px] font-mono mb-1 flex items-center gap-1">
                  <Activity size={10} /> {displayPair} (OTC)
                </p>
                <h2 className={`text-5xl font-mono font-black tracking-tighter ${history[history.length - 1] > history[history.length - 2] ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'}`}>
                  {price.toFixed(5)}
                </h2>
              </div>

              <div className="text-right bg-gray-800/50 p-3 rounded-xl border border-gray-700/50 backdrop-blur-sm min-w-[120px]">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">{tt.terminalCapitalInPlans || 'Capital em Planos'}</p>
                <p className="text-xl font-bold font-mono text-white">
                  ${Number(totals.totalCapital || 0).toFixed(2)}
                </p>
                <p className="text-[9px] text-gray-500 mt-1 leading-tight">
                  {tt.terminalProfitToday || 'Lucro hoje'}: <span className="text-green-400">+${Number(totals.profitToday || 0).toFixed(4)}</span>
                </p>
              </div>
            </div>

            <div className="w-full rounded-xl border border-gray-800/50 overflow-hidden shadow-inner bg-gradient-to-b from-gray-800/20 to-transparent">
              <div className="flex flex-col xl:flex-row">
                <div className="relative h-64 w-full overflow-hidden">
                  <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-5 pointer-events-none">
                    {[...Array(24)].map((_, i) => <div key={i} className="border border-gray-500"></div>)}
                  </div>

                  <svg viewBox="0 0 300 100" className="w-full h-full relative z-10" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={trend === 'bull' ? '#4ade80' : '#f87171'} stopOpacity="0.10" />
                        <stop offset="100%" stopColor={trend === 'bull' ? '#4ade80' : '#f87171'} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="300" height="100" fill="url(#chartGradient)" />

                    {expirationAtNY && (
                      <>
                        <line x1={chart.expX} x2={chart.expX} y1="0" y2="100" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" opacity="0.9" />
                        <circle cx={chart.expX} cy={chart.expY} r="2.2" fill="#f59e0b" />

                        <text x={chart.expX - 2} y="10" textAnchor="end" fill="#cbd5e1" fontSize="6.5" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
                          {(tt.terminalExpiration || 'Expiration').toUpperCase()}
                        </text>
                        <text x={chart.expX - 2} y="18" textAnchor="end" fill="#fbbf24" fontSize="8" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" fontWeight="700">
                          {formatTimeNY(expirationAtNY)}
                        </text>
                      </>
                    )}

                    {chart.candleDraw.map((c, idx) => (
                      <g key={idx} opacity="0.95">
                        <line x1={c.x} x2={c.x} y1={c.yHigh} y2={c.yLow} stroke={c.color} strokeWidth="1" />
                        <rect x={c.body.x} y={c.body.y} width={c.body.w} height={c.body.h} fill={c.color} rx="0.7" />
                      </g>
                    ))}
                  </svg>

                  <div className={`absolute right-0 top-1/2 w-1.5 h-1.5 rounded-full ${trend === 'bull' ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-red-400 shadow-[0_0_10px_#f87171]'} animate-ping`}></div>
                </div>

                <div className="w-full xl:w-[260px] border-t xl:border-t-0 xl:border-l border-gray-800 bg-black/35 backdrop-blur p-3 flex flex-col gap-3">
                  <button
                    onClick={() => setPanelOpen(v => !v)}
                    className="xl:hidden w-full bg-gray-900/40 border border-gray-800 rounded px-3 py-2 flex items-center justify-between text-gray-200"
                  >
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider">{tt.terminalControls || 'Controls'}</span>
                    <span className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
                      {displayPair} • {selectedAssetGroup} • {selectedExpiration} • ${Number(selectedAmount || 0).toFixed(2)}
                      {panelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  <div className={`${panelOpen ? 'block' : 'hidden'} xl:block flex flex-col gap-3`}>
                    <div className="bg-gray-900/40 border border-gray-800 rounded p-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">{tt.terminalAsset || 'Asset'}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSelectedAssetGroup('AUTO')}
                          className={`text-[10px] font-mono font-bold py-2 rounded border transition whitespace-nowrap ${selectedAssetGroup === 'AUTO' ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                        >
                          {tt.terminalAuto || 'Auto'}
                        </button>
                        <button
                          onClick={() => setSelectedAssetGroup('FX')}
                          className={`text-[10px] font-mono font-bold py-2 rounded border transition whitespace-nowrap ${selectedAssetGroup === 'FX' ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                        >
                          FX
                        </button>
                        <button
                          onClick={() => setSelectedAssetGroup('METALS')}
                          className={`text-[10px] font-mono font-bold py-2 rounded border transition whitespace-nowrap ${selectedAssetGroup === 'METALS' ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                        >
                          {tt.terminalMetals || 'Metals'}
                        </button>
                        <button
                          onClick={() => setSelectedAssetGroup('CRYPTO')}
                          className={`text-[10px] font-mono font-bold py-2 rounded border transition whitespace-nowrap ${selectedAssetGroup === 'CRYPTO' ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                        >
                          {tt.terminalCrypto || 'Crypto'}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="bg-gray-900/40 border border-gray-800 rounded p-2 flex-1 min-w-0">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{tt.terminalAmount || 'Amount'}</div>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <button
                            onClick={() => setSelectedAmount(v => Math.max(1, (Number(v) || 0) - 5))}
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-gray-800/70 border border-gray-700 text-gray-200 text-xs sm:text-sm font-mono font-bold hover:bg-gray-800 transition flex items-center justify-center shrink-0"
                          >
                            -
                          </button>
                          <div className="text-xs sm:text-sm font-mono font-bold text-white text-center truncate">
                            ${Number(selectedAmount || 0).toFixed(2)}
                          </div>
                          <button
                            onClick={() => setSelectedAmount(v => Math.min(1000, (Number(v) || 0) + 5))}
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-gray-800/70 border border-gray-700 text-gray-200 text-xs sm:text-sm font-mono font-bold hover:bg-gray-800 transition flex items-center justify-center shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="bg-gray-900/40 border border-gray-800 rounded p-2 w-[70px] sm:w-[80px] shrink-0">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{tt.terminalPayout || 'Payout'}</div>
                        <div className="mt-1 flex items-center h-6 sm:h-7 text-xs sm:text-sm font-mono font-bold text-green-400">
                          +{Number(payoutPct || 0).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900/40 border border-gray-800 rounded p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{tt.terminalExpiration || 'Expiration'}</span>
                        <span className="text-xs font-mono font-bold text-yellow-300">
                          {expirationAtNY ? formatTimeNY(expirationAtNY) : formatTimeNY(selectedExpirationAtNY)}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setSelectedExpiration('1m')}
                          className={`flex-1 text-[10px] font-mono font-bold py-2 rounded border transition ${selectedExpiration === '1m' ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                        >
                          1m
                        </button>
                        <button
                          onClick={() => setSelectedExpiration('5m')}
                          className={`flex-1 text-[10px] font-mono font-bold py-2 rounded border transition ${selectedExpiration === '5m' ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                        >
                          5m
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-900/40 border border-gray-800 rounded p-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{tt.terminalPair || 'Pair'}</div>
                      <div className="text-sm font-mono font-bold text-white">{displayPair}</div>
                      <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-gray-500">{lastOp?.exchange || '—'}</span>
                        <span className={`${lastOp?.direction === 'HIGHER' ? 'text-green-400' : 'text-red-400'} font-bold whitespace-nowrap`}>
                          {dirLabel(lastOp?.direction)} {lastOp?.expiration || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col min-h-0">
              <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold px-3 py-2 bg-gray-800/30 rounded mb-1">
                <span>{tt.terminalTableAssetExchange || 'Asset / Exchange'}</span>
                <span className="text-center">{tt.terminalTableDirectionExp || 'Direction / Exp.'}</span>
                <span className="text-right">{tt.terminalTableResult || 'Result'}</span>
              </div>

              <div className="space-y-1.5 overflow-y-auto pr-1 custom-scrollbar max-h-60">
                {ops.map(op => (
                  <div key={op.id} className="bg-gray-800/30 p-2 rounded flex justify-between items-center text-xs font-mono border-l-2 transition-all duration-300"
                    style={{ borderColor: op.result === 'WIN' ? '#4ade80' : '#f87171' }}>
                    <div className="flex flex-col">
                      <span className="text-gray-200 font-bold">{op.pair}</span>
                      <span className="text-[9px] text-gray-500">{op.exchange}</span>
                    </div>
                    <div className="text-center">
                      <div className={`flex items-center justify-center gap-1 font-bold ${op.direction === 'HIGHER' ? 'text-green-400' : 'text-red-400'}`}>
                        {op.direction === 'HIGHER' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                        {dirLabel(op.direction)}
                      </div>
                      <span className="text-[9px] text-blue-300 bg-blue-900/10 px-1 rounded">{op.expiration}</span>
                    </div>
                    <span className={`${op.result === 'WIN' ? 'text-green-400' : 'text-red-400'} font-bold bg-gray-900/50 px-2 py-1 rounded min-w-[60px] text-right`}>
                      {op.result === 'WIN'
                        ? `${tt.terminalWin || 'WIN'} +${Number(op.pnl).toFixed(2)}`
                        : `${tt.terminalLoss || 'LOSS'} -${Number(op.stake).toFixed(2)}`}
                    </span>
                  </div>
                ))}
                {ops.length === 0 && (
                  <div className="text-center text-gray-600 text-xs py-8 font-mono border border-dashed border-gray-800 rounded">
                    {tt.terminalWaitingForTradingCredit || 'Waiting for trading credit...'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur p-3 flex flex-wrap gap-4 justify-between text-[10px] sm:text-xs text-gray-400 font-mono border-t border-gray-800">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-yellow-500" />
            {tt.terminalProtection || 'Protection'}: <span className="text-white">AI-GUARD V2</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={14} className="text-blue-500" />
            {tt.terminalLatency || 'Latency'}: <span className="text-green-400">12ms</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Activity size={14} className="text-purple-500" />
            {tt.terminalOps || 'Ops'}: <span className="text-white">{opsCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
});
