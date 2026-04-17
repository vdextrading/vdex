import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Play, RefreshCw, Pause, Zap, XCircle, Clock } from 'lucide-react';
import { RUNNER_MAX_TIME, createRunnerEngine } from './platformRunner/runnerEngine';
import { drawRunner } from './platformRunner/runnerRenderer';

export const PlatformRunner = ({ t, onClose, onGameOver, onConsumeEnergy, highScore, userSparks }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const lastFrameRef = useRef(0);
  const lastInputRef = useRef(0);
  const lastKeyJumpRef = useRef(0);
  const engineRef = useRef(null);
  const gameStateRef = useRef('menu');

  const [gameState, setGameState] = useState('menu'); // menu | playing | paused | gameover
  const [ui, setUi] = useState({ score: 0, sparks: 0, timeLeft: RUNNER_MAX_TIME, level: 1, reason: 'timeout' });
  const [startError, setStartError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const setGameStateSafe = useCallback((next) => {
    gameStateRef.current = next;
    setGameState(next);
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    setPortalReady(typeof document !== 'undefined' && Boolean(document.body));
  }, []);

  const i18n = useMemo(() => ({
    title: t?.runnerTitle || 'PLATFORM RUNNER',
    subtitle: t?.runnerSubtitle || 'Jump, dodge and collect Sparks.',
    start: t?.runnerStart || (t?.play || 'PLAY'),
    resume: t?.runnerResume || 'RESUME',
    restart: t?.runnerRestart || 'RESTART',
    paused: t?.runnerPaused || 'PAUSED',
    gameOver: t?.runnerGameOver || 'GAME OVER',
    reasonTimeout: t?.runnerReasonTimeout || 'TIME UP',
    reasonHit: t?.runnerReasonHit || 'HIT',
    tapToJump: t?.runnerTapToJump || 'Tap / Space to jump',
    time: t?.runnerTime || 'Time',
    lvl: t?.runnerLevel || 'Level',
    score: t?.runnerScore || 'Score',
    best: t?.runnerBest || 'Best',
    totalSparks: t?.runnerTotalSparks || 'Total Sparks',
    energyUnit: t?.gameEnergyUnit || 'ENERGY',
    sparksUnit: t?.gameSparksUnit || 'Sparks',
    needEnergy: t?.runnerNeedEnergy || 'You need ENERGY to play.'
  }), [t]);

  const ensureCanvasSize = useCallback(() => {
    const el = containerRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return { ok: false };
    const w = Math.max(320, el.clientWidth);
    const h = Math.max(520, el.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    const ctx = cv.getContext('2d');
    if (!ctx) return { ok: false };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!engineRef.current) engineRef.current = createRunnerEngine();
    engineRef.current.resetSize(w, h);
    return { ok: true, ctx };
  }, []);

  useEffect(() => {
    ensureCanvasSize();
    const onResize = () => ensureCanvasSize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [ensureCanvasSize]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const renderFrame = useCallback((ts) => {
    if (gameStateRef.current !== 'playing') return;
    try {
      const { ok, ctx } = ensureCanvasSize();
      if (!ok || !ctx || !engineRef.current) {
        setGameStateSafe('menu');
        setStartError(t?.runnerInitFail || 'Falha ao iniciar o jogo. Tente novamente.');
        stopLoop();
        return;
      }
      if (!lastFrameRef.current) lastFrameRef.current = ts;
      const dt = Math.min(0.05, Math.max(0, (ts - lastFrameRef.current) / 1000));
      lastFrameRef.current = ts;
      const sec = ts / 1000;

      const reason = engineRef.current.step(dt, sec);
      const snap = engineRef.current.snapshot();
      drawRunner(ctx, snap, engineRef.current.cfg);
      setUi(prev => ({
        ...prev,
        score: Math.floor(snap.score),
        sparks: Math.floor(snap.sparks),
        timeLeft: Math.ceil(snap.timeLeft),
        level: snap.level,
        reason: reason || prev.reason
      }));

      if (reason) {
        stopLoop();
        setGameStateSafe('gameover');
        if (onGameOver) onGameOver(Math.floor(snap.score), Math.floor(snap.sparks));
        return;
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    } catch (e) {
      setGameStateSafe('menu');
      setStartError(t?.runnerInitFail || 'Falha ao iniciar o jogo. Tente novamente.');
      stopLoop();
    }
  }, [ensureCanvasSize, onGameOver, setGameStateSafe, stopLoop]);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  const start = useCallback(async () => {
    setStartError(null);
    const { ok } = ensureCanvasSize();
    if (!ok) {
      setStartError(t?.runnerInitFail || 'Falha ao iniciar o jogo. Tente novamente.');
      return;
    }
    if (starting) return;
    setStarting(true);
    try {
      if (onConsumeEnergy) {
        const okConsume = await onConsumeEnergy();
        if (!okConsume) {
          setStartError(i18n.needEnergy);
          return;
        }
      }
      const now = performance.now() / 1000;
      engineRef.current.resetWorld(now);
      setUi({ score: 0, sparks: 0, timeLeft: RUNNER_MAX_TIME, level: 1, reason: 'timeout' });
      setGameStateSafe('playing');
      lastFrameRef.current = 0;
      stopLoop();
      rafRef.current = requestAnimationFrame(renderFrame);
    } finally {
      setStarting(false);
    }
  }, [ensureCanvasSize, i18n.needEnergy, onConsumeEnergy, renderFrame, starting, stopLoop]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameStateSafe('paused');
      stopLoop();
      return;
    }
    if (gameState === 'paused') {
      setGameStateSafe('playing');
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(renderFrame);
    }
  }, [gameState, renderFrame, setGameStateSafe, stopLoop]);

  const jump = useCallback(() => {
    if (gameState !== 'playing') return;
    engineRef.current?.jump?.(performance.now() / 1000);
  }, [gameState]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (gameState === 'menu' || gameState === 'gameover') return;
        if (gameState === 'paused') {
          togglePause();
          return;
        }
        const now = Date.now();
        if (e.repeat && now - lastKeyJumpRef.current < 120) return;
        lastKeyJumpRef.current = now;
        jump();
      }
      if (e.code === 'Escape' && gameState === 'playing') togglePause();
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, jump, togglePause]);

  const onTap = useCallback(() => {
    const now = Date.now();
    if (now - lastInputRef.current < 16) return;
    lastInputRef.current = now;
    if (gameState === 'paused') {
      togglePause();
      return;
    }
    if (gameState !== 'playing') return;
    jump();
  }, [gameState, jump, togglePause]);

  const menu = (
    <div className="w-full max-w-md mx-auto text-center px-6">
      <div className="bg-gray-900 border border-blue-500/20 rounded-2xl p-8 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Zap className="text-yellow-400" />
          <h1 className="text-3xl font-black text-white tracking-widest">{i18n.title}</h1>
        </div>
        <p className="text-gray-400 text-sm">{i18n.subtitle}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
            <div className="text-gray-500">{i18n.best}</div>
            <div className="text-white font-black text-lg">{Number(highScore) || 0}</div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
            <div className="text-gray-500">{i18n.totalSparks}</div>
            <div className="text-yellow-300 font-black text-lg">{Number(userSparks) || 0}</div>
          </div>
        </div>
        <div className="mt-6 text-xs text-gray-500">{i18n.tapToJump}</div>
        {startError && <div className="mt-3 text-xs text-red-400 font-bold">{startError}</div>}
        <button
          onClick={start}
          disabled={starting}
          className={`mt-6 w-full text-white font-black py-4 rounded-xl tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.45)] transition ${
            starting ? 'bg-blue-600/60 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {i18n.start}
        </button>
      </div>
    </div>
  );

  const overlay = gameState === 'paused' ? (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm text-center">
        <div className="text-white font-black text-2xl tracking-widest">{i18n.paused}</div>
        <div className="text-gray-400 text-sm mt-2">{i18n.tapToJump}</div>
        <div className="mt-6 flex gap-3">
          <button onClick={togglePause} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl">
            {i18n.resume}
          </button>
          <button onClick={start} disabled={starting} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl border border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed">
            <span className="inline-flex items-center justify-center gap-2"><RefreshCw size={16} /> {i18n.restart}</span>
          </button>
        </div>
      </div>
    </div>
  ) : gameState === 'gameover' ? (
    <div className="absolute inset-0 bg-black/78 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
          <XCircle />
          <div className="font-black text-xl tracking-widest">{i18n.gameOver}</div>
        </div>
        <div className="text-gray-400 text-sm">
          {ui.reason === 'hit' ? i18n.reasonHit : i18n.reasonTimeout}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-mono">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
            <div className="text-gray-500">{i18n.score}</div>
            <div className="text-white font-black text-base">{ui.score}</div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
            <div className="text-gray-500">{i18n.sparksUnit}</div>
            <div className="text-yellow-300 font-black text-base">{ui.sparks}</div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
            <div className="text-gray-500">{i18n.lvl}</div>
            <div className="text-white font-black text-base">{ui.level}</div>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={start} disabled={starting} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed">
            <span className="inline-flex items-center justify-center gap-2"><RefreshCw size={16} /> {i18n.restart}</span>
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl border border-gray-700">
            OK
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const content = (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[99999] flex flex-col animate-fadeIn">
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-gray-950/90 to-transparent">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800/60 transition">
          <ArrowLeft className="text-gray-300" />
        </button>
        <div className="flex items-center gap-2 text-gray-300 text-xs font-mono">
          <Clock size={14} className="text-blue-400" />
          <span>{i18n.time}: <span className="text-white font-black">{ui.timeLeft}s</span></span>
          <span className="text-gray-500">|</span>
          <span>{i18n.lvl}: <span className="text-white font-black">{ui.level}</span></span>
          <span className="text-gray-500">|</span>
          <span>{i18n.sparksUnit}: <span className="text-yellow-300 font-black">{ui.sparks}</span></span>
        </div>
        <button onClick={togglePause} className="p-2 rounded-full hover:bg-gray-800/60 transition">
          {gameState === 'playing' ? <Pause className="text-gray-300" /> : <Play className="text-gray-300" />}
        </button>
      </div>

      <div ref={containerRef} className="flex-1 w-full relative touch-none" onPointerDown={onTap}>
        <canvas ref={canvasRef} className="w-full h-full" />
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center">{menu}</div>
        )}
        {overlay}
      </div>
    </div>
  );

  if (portalReady) return createPortal(content, document.body);
  return content;
};
