'use client';

import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Cpu, Activity, ShieldCheck, Zap, ArrowUp, ArrowDown, Clock } from 'lucide-react';

export const TradingTerminal = React.forwardRef(({ activePlan, schedule, onSync }, ref) => {
  const [price, setPrice] = useState(1.0542);
  const [history, setHistory] = useState(Array(40).fill(1.0542));
  const [ops, setOps] = useState([]);
  const [sessionProfit, setSessionProfit] = useState(0);
  const [opsCount, setOpsCount] = useState(0);
  const [trend, setTrend] = useState('bull');
  const [minuteTimeLeft, setMinuteTimeLeft] = useState(Number(schedule?.cycleSeconds) || 600);
  const [minuteReport, setMinuteReport] = useState(null);
  const [currentMinuteStats, setCurrentMinuteStats] = useState({ wins: 0, losses: 0, profit: 0, ops: 0 });
  const [cycleBadgeTs, setCycleBadgeTs] = useState(0);
  
  const priceRef = useRef(1.0542);
  const profitBufferRef = useRef(0); // Para acumular lucro sem re-renderizar tudo
  const opsCountRef = useRef(0); // Ref para acesso síncrono no timer
  const cycleStartRef = useRef(Date.now()); // Para rastrear início do ciclo
  const currentMinuteStatsRef = useRef({ wins: 0, losses: 0, profit: 0, ops: 0 }); // Ref para evitar dependências circulares

  const scheduleStatus = schedule?.status || 'idle';
  const scheduleMode = schedule?.mode || 'analysis';
  const cycleSeconds = Number(schedule?.cycleSeconds) || 600;
  const cycleTargetProfit = scheduleStatus === 'running' && scheduleMode === 'trade'
    ? Number(schedule?.cycleTargetProfit || 0)
    : 0;
  const breakdown = scheduleStatus === 'running'
    ? (Array.isArray(schedule?.breakdown) ? schedule.breakdown : [])
    : [];
  const scheduleRef = useRef({ status: scheduleStatus, mode: scheduleMode, cycleSeconds, cycleTargetProfit, breakdown });
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  useEffect(() => {
    scheduleRef.current = { status: scheduleStatus, mode: scheduleMode, cycleSeconds, cycleTargetProfit, breakdown };
  }, [scheduleStatus, scheduleMode, cycleSeconds, cycleTargetProfit, breakdown]);

  useEffect(() => {
    const { status, mode, cycleSeconds, cycleTargetProfit, breakdown } = scheduleRef.current;
    const canRun = status === 'running' || status === 'analysis';
    const canTrade = status === 'running' && mode === 'trade';
    const startMs = Number(schedule?.currentCycleStartedAt) || Date.now();
    const now = Date.now();

    if (!canRun) {
      cycleStartRef.current = startMs;
      lastSimTimeRef.current = now;
      setMinuteTimeLeft(0);
      setSessionProfit(0);
      setOpsCount(0);
      setOps([]);
      profitBufferRef.current = 0;
      opsCountRef.current = 0;
      return;
    }

    cycleStartRef.current = startMs;
    lastSimTimeRef.current = now;

    const elapsed = (now - startMs) / 1000;
    if (elapsed >= cycleSeconds) {
      if (canTrade) {
        const ops = opsCountRef.current > 0 ? opsCountRef.current : randInt(80, 160);
        onSync(cycleTargetProfit, ops, breakdown);
      } else if (Array.isArray(breakdown) && breakdown.length) {
        onSync(0, 0, breakdown);
      }
      return;
    }

    setMinuteTimeLeft(Math.max(0, cycleSeconds - Math.floor(elapsed)));
  }, [activePlan.planId, schedule?.currentCycleStartedAt, scheduleStatus, scheduleMode, cycleSeconds, cycleTargetProfit]);

  const trendRef = useRef('bull');
  const lastSimTimeRef = useRef(Date.now());
  const lastEndCycleRef = useRef(0);

  const endCycle = (now, forced = false) => {
    if (now - lastEndCycleRef.current < 500) return;
    lastEndCycleRef.current = now;
    const { status, mode, cycleSeconds, cycleTargetProfit, breakdown } = scheduleRef.current;
    if (!(status === 'running' || status === 'analysis')) return;
    const canTrade = status === 'running' && mode === 'trade';

    if (canTrade) {
      if (forced && opsCountRef.current === 0) {
        opsCountRef.current = randInt(120, 260);
        setOpsCount(opsCountRef.current);
      }

      const diff = cycleTargetProfit - profitBufferRef.current;
      profitBufferRef.current += diff;
      currentMinuteStatsRef.current.profit += diff;
      setSessionProfit(p => p + diff);
      setCurrentMinuteStats(prev => ({ ...prev, profit: prev.profit + diff }));
    }

    const stats = currentMinuteStatsRef.current;
    setMinuteReport({
      ...stats,
      timestamp: new Date().toLocaleTimeString(),
      id: now
    });
    setCycleBadgeTs(now);

    if (canTrade) {
      onSync(cycleTargetProfit, opsCountRef.current, breakdown);
    } else {
      onSync(0, 0, breakdown);
    }

    profitBufferRef.current = 0;
    opsCountRef.current = 0;

    cycleStartRef.current = now;
    lastSimTimeRef.current = now; 
    currentMinuteStatsRef.current = { wins: 0, losses: 0, profit: 0, ops: 0 };
    setCurrentMinuteStats({ wins: 0, losses: 0, profit: 0, ops: 0 });
    setSessionProfit(0);
    setOpsCount(0);
    setOps([]);
    setMinuteTimeLeft(cycleSeconds);
  };

  useImperativeHandle(ref, () => ({
    advanceOneCycle: () => {
      endCycle(Date.now(), true);
    }
  }), []);

  // Main HFT Engine Loop (Timer + Simulation + Catch-up)
  useEffect(() => {
    const interval = setInterval(() => {
      const { status, mode, cycleSeconds, cycleTargetProfit, breakdown } = scheduleRef.current;
      if (!(status === 'running' || status === 'analysis')) return;
      const canTrade = status === 'running' && mode === 'trade';
      const now = Date.now();
      const cycleStart = cycleStartRef.current;
      const elapsed = (now - cycleStart) / 1000;
      
      if (elapsed >= cycleSeconds) {
        endCycle(now);
        return; 
      }
      
      setMinuteTimeLeft(Math.max(0, cycleSeconds - Math.floor(elapsed)));

      if (!canTrade) return;

      // --- 2. Simulation Catch-up ---
      const timeSinceLastSim = now - lastSimTimeRef.current;
      // We target ~1 step per 1000ms
      const stepDuration = 1000; 
      const stepsToCatchUp = Math.floor(timeSinceLastSim / stepDuration);
      
      if (stepsToCatchUp > 0) {
         for (let i = 0; i < stepsToCatchUp; i++) {
             simulateStep();
         }
         lastSimTimeRef.current += stepsToCatchUp * stepDuration;
      }
      
    }, 1000); 

    return () => clearInterval(interval);
  }, [activePlan.planId, onSync]);

  const simulateStep = () => {
      // 1. Simulação de Preço
      const volatility = 0.0005;
      const trendBias = trendRef.current === 'bull' ? 0.0002 : -0.0002;
      const change = priceRef.current * (volatility * (Math.random() - 0.5) + trendBias);
      const newPrice = priceRef.current + change;
      
      priceRef.current = newPrice;
      setPrice(newPrice);
      setHistory(prev => [...prev.slice(1), newPrice]);

      // Mudar tendência
      if (Math.random() < 0.05) {
          trendRef.current = trendRef.current === 'bull' ? 'bear' : 'bull';
          setTrend(trendRef.current);
      }

      // 2. Execução de Ordens
      if (Math.random() < 0.35) { 
        const exchange = Math.random() > 0.5 ? 'CASATRADE' : 'EXNOVA';
        const randType = Math.random();
        let pair, type, side;
        
        if (randType < 0.80) {
            const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/CAD', 'EUR/JPY', 'USD/CHF', 'NZD/USD'];
            pair = pairs[Math.floor(Math.random() * pairs.length)];
            type = 'BINARY';
        } else if (randType < 0.90) {
            const cryptos = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD'];
            pair = cryptos[Math.floor(Math.random() * cryptos.length)];
            type = 'CRYPTO';
        } else {
            const stocks = ['AAPL', 'TSLA', 'AMZN', 'GOOGL', 'NVDA', 'MSFT', 'META'];
            pair = stocks[Math.floor(Math.random() * stocks.length)];
            type = 'STOCK';
        }

        const { cycleTargetProfit, cycleSeconds } = scheduleRef.current;
        const entryAmount = Math.max(0.5, activePlan.amount * 0.0005); 
        const payout = 0.90; 

        const currentMinuteProfit = currentMinuteStatsRef.current.profit;
        
        const elapsedSec = Math.floor((Date.now() - cycleStartRef.current) / 1000);
        const expectedProfitNow = (cycleTargetProfit / cycleSeconds) * elapsedSec;

        let isWin;
        
        if (currentMinuteProfit < expectedProfitNow - (entryAmount * 2)) {
             isWin = true;
        } 
        else if (currentMinuteProfit > expectedProfitNow + (entryAmount * 3)) {
             isWin = false;
        } 
        else {
             const baseWinRate = 0.58; 
             const noise = (Math.random() - 0.5) * 0.10; 
             isWin = Math.random() < (baseWinRate + noise);
        }

        side = trendRef.current === 'bull' ? 'CALL' : 'PUT';
        
        const pnl = isWin ? (entryAmount * payout) : -entryAmount;

        const newOp = {
          id: Date.now() + Math.random(), // Ensure unique ID in fast loop
          exchange,
          pair,
          type,
          side,
          pnl: pnl,
          time: new Date().toLocaleTimeString()
        };

        setOps(prev => [newOp, ...prev.slice(0, 6)]); 
        
        setSessionProfit(p => p + pnl);
        profitBufferRef.current += pnl;
        
        opsCountRef.current += 1;
        setOpsCount(c => c + 1);

        currentMinuteStatsRef.current.ops += 1;
        currentMinuteStatsRef.current.profit += pnl;
        if (isWin) currentMinuteStatsRef.current.wins += 1;
        else currentMinuteStatsRef.current.losses += 1;
        
        setCurrentMinuteStats(prev => ({
            ...prev,
            ops: prev.ops + 1,
            profit: prev.profit + pnl,
            wins: isWin ? prev.wins + 1 : prev.wins,
            losses: isWin ? prev.losses : prev.losses + 1
        }));
      }
  };

  // SVG Chart Logic
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = (max - min) || 1; // Evita divisão por zero
  const points = history.length > 1 
    ? history.map((p, i) => {
        const x = (i / (history.length - 1)) * 300;
        const y = 100 - ((p - min) / range) * 80;
        return `${x},${y}`;
      }).join(' ')
    : "0,100 300,100"; // Fallback para gráfico vazio


  const formatTime = (seconds) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-6 animate-fadeIn px-2 sm:px-4">
      {/* Container Principal com Efeito Glassmorphism e Borda Neon */}
      <div className="bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-blue-500/30 shadow-[0_0_40px_rgba(37,99,235,0.15)] overflow-hidden relative">
        
        {/* Header do Terminal */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40 animate-pulse"></div>
              <Cpu className="text-blue-400 relative z-10" size={20} />
            </div>
            <div>
              <h3 className="text-white font-black font-mono text-sm tracking-widest">HFT ENGINE V4.0</h3>
              <p className={`text-[10px] font-mono flex items-center gap-1 ${scheduleStatus === 'running' ? (scheduleMode === 'trade' ? 'text-blue-400' : 'text-yellow-400') : scheduleStatus === 'done' ? 'text-green-400' : 'text-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${scheduleStatus === 'running' ? (scheduleMode === 'trade' ? 'bg-blue-500 animate-ping' : 'bg-yellow-400 animate-pulse') : scheduleStatus === 'done' ? 'bg-green-400' : 'bg-gray-500'}`}></span>
                {scheduleStatus === 'running' ? (scheduleMode === 'trade' ? 'RUNNING' : 'ANALISANDO') : scheduleStatus === 'done' ? 'META ATINGIDA' : 'PAUSADO'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
             <span className="text-[10px] text-gray-500 font-mono mb-1">
               {scheduleStatus === 'running' ? (scheduleMode === 'analysis' ? 'ANÁLISE' : 'REPORT IN') : 'STATUS'}
             </span>
             <div className="bg-gray-800 border border-gray-600 rounded px-2 py-1 flex items-center gap-2">
                <Clock size={12} className="text-yellow-400" />
                <span className={`text-xs font-mono font-bold ${minuteTimeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                  {(scheduleStatus === 'running' || scheduleStatus === 'analysis') ? formatTime(Math.floor(minuteTimeLeft)) : '--'}
                </span>
             </div>
             {cycleBadgeTs > 0 && (Date.now() - cycleBadgeTs < 2500) && (
               <span className="mt-2 text-[10px] font-mono bg-green-600/15 text-green-300 px-2 py-1 rounded">
                 Ciclo atual concluído
               </span>
             )}
          </div>
        </div>

        {scheduleStatus === 'running' && scheduleMode === 'analysis' && (
          <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-200 text-xs flex items-center justify-between">
            <span className="font-bold tracking-wide">
              ANALISANDO A MELHOR ENTRADA
            </span>
            <span className="text-yellow-300/80 font-mono">Retorno automático</span>
          </div>
        )}

        {/* Display Principal (Preço e PnL Sessão) */}
        <div className="p-4 flex flex-col gap-4">
          
          {/* Top Row: Price & Equity */}
          <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                 <div>
                    <p className="text-gray-400 text-[10px] font-mono mb-1 flex items-center gap-1">
                      <Activity size={10} /> EUR/USD (OTC)
                    </p>
                    <h2 className={`text-5xl font-mono font-black tracking-tighter ${history[history.length-1] > history[history.length-2] ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'}`}>
                      {price.toFixed(5)}
                    </h2>
                 </div>
                 
                 <div className="text-right bg-gray-800/50 p-3 rounded-xl border border-gray-700/50 backdrop-blur-sm min-w-[120px]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Total Equity</p>
                    <p className="text-xl font-bold font-mono text-white">
                      ${(activePlan.amount + (activePlan.accumulated || 0) + sessionProfit).toFixed(2)}
                    </p>
                    <p className="text-[9px] text-gray-500 mt-1">
                      Invested: <span className="text-blue-400">${activePlan.amount.toFixed(2)}</span>
                    </p>
                 </div>
              </div>

              {/* Gráfico Dinâmico */}
              <div className="h-64 w-full bg-gradient-to-b from-gray-800/20 to-transparent rounded-xl border border-gray-800/50 relative overflow-hidden shadow-inner">
                  {/* Grid */}
                  <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-5 pointer-events-none">
                      {[...Array(24)].map((_, i) => <div key={i} className="border border-gray-500"></div>)}
                  </div>
                  
                  <svg viewBox="0 0 300 100" className="w-full h-full relative z-10" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={trend === 'bull' ? '#4ade80' : '#f87171'} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={trend === 'bull' ? '#4ade80' : '#f87171'} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon 
                        fill="url(#chartGradient)" 
                        points={`${points} 300,100 0,100`} 
                      />
                      <polyline 
                        fill="none" 
                        stroke={trend === 'bull' ? '#4ade80' : '#f87171'} 
                        strokeWidth="2" 
                        points={points} 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]"
                      />
                  </svg>
                  
                  {/* Ping Indicador */}
                  <div className={`absolute right-0 top-1/2 w-1.5 h-1.5 rounded-full ${trend === 'bull' ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-red-400 shadow-[0_0_10px_#f87171]'} animate-ping`}></div>
              </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Relatório do Último Minuto */}
            {minuteReport && (
              <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-3 flex justify-between items-center animate-fadeIn">
                  <div className="flex flex-col">
                      <span className="text-[9px] text-blue-300 font-bold uppercase tracking-wider">Minute Report</span>
                      <span className="text-[9px] text-gray-400 font-mono">{minuteReport.timestamp}</span>
                  </div>
                  <div className="flex gap-4 text-xs font-mono">
                      <div className="text-center">
                          <span className="text-[8px] text-gray-500 block uppercase">Wins</span>
                          <span className="text-green-400 font-bold">{minuteReport.wins}</span>
                      </div>
                      <div className="text-center">
                          <span className="text-[8px] text-gray-500 block uppercase">Loss</span>
                          <span className="text-red-400 font-bold">{minuteReport.losses}</span>
                      </div>
                      <div className="text-center pl-2 border-l border-gray-700">
                          <span className="text-[8px] text-gray-500 block uppercase">Net P&L</span>
                          <span className={`${minuteReport.profit >= 0 ? 'text-green-400' : 'text-red-400'} font-bold`}>
                              {minuteReport.profit >= 0 ? '+' : ''}{minuteReport.profit.toFixed(2)}
                          </span>
                      </div>
                  </div>
              </div>
            )}

            {/* Lista de Operações */}
            <div className="flex flex-col min-h-0">
              <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold px-3 py-2 bg-gray-800/30 rounded mb-1">
                <span>Pair / Exchange</span>
                <span className="text-center">Side / Type</span>
                <span className="text-right">P&L (USDT)</span>
              </div>
              
              <div className="space-y-1.5 overflow-y-auto pr-1 custom-scrollbar max-h-60">
                {ops.map(op => (
                  <div key={op.id} className="bg-gray-800/30 p-2 rounded flex justify-between items-center text-xs font-mono border-l-2 transition-all duration-300" 
                      style={{ borderColor: Number(op.pnl) > 0 ? '#4ade80' : '#f87171' }}>
                    <div className="flex flex-col">
                        <span className="text-gray-200 font-bold">{op.pair}</span>
                        <span className="text-[9px] text-gray-500">{op.exchange}</span>
                    </div>
                    <div className="text-center">
                        <div className={`flex items-center justify-center gap-1 font-bold ${op.side === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                          {op.side === 'LONG' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                          {op.side}
                        </div>
                        <span className="text-[9px] text-blue-300 bg-blue-900/10 px-1 rounded">{op.type}</span>
                    </div>
                    <span className={`${Number(op.pnl) > 0 ? 'text-green-400' : 'text-red-400'} font-bold bg-gray-900/50 px-2 py-1 rounded min-w-[60px] text-right`}>
                      {Number(op.pnl) > 0 ? '+' : ''}{Number(op.pnl).toFixed(4)}
                    </span>
                  </div>
                ))}
                {ops.length === 0 && (
                  <div className="text-center text-gray-600 text-xs py-8 font-mono border border-dashed border-gray-800 rounded">
                    Aguardando sinal da IA...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer Info */}
        <div className="bg-black/40 backdrop-blur p-3 flex flex-wrap gap-4 justify-between text-[10px] sm:text-xs text-gray-400 font-mono border-t border-gray-800">
           <span className="flex items-center gap-1.5">
             <ShieldCheck size={14} className="text-yellow-500"/> 
             PROTECTION: <span className="text-white">AI-GUARD V2</span>
           </span>
           <span className="flex items-center gap-1.5">
             <Zap size={14} className="text-blue-500"/> 
             LATENCY: <span className="text-green-400">12ms</span>
           </span>
           <span className="flex items-center gap-1.5">
             <Activity size={14} className="text-purple-500"/> 
             OPS: <span className="text-white">{opsCount}</span>
           </span>
        </div>
      </div>
    </div>
  );
});
