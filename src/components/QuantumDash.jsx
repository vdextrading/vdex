import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Play, RefreshCw, Trophy, Zap, ShieldCheck, Pause, XCircle, Clock } from 'lucide-react';

const MAX_GAME_TIME = 240; // 240 seconds (4 minutes)

export const QuantumDash = ({ onClose, onGameOver, highScore, userSparks }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [gameState, setGameState] = useState('menu'); // menu, playing, gameover, paused
  const [score, setScore] = useState(0);
  const [sparks, setSparks] = useState(0);
  const [combo, setCombo] = useState(1);
  const [timeLeft, setTimeLeft] = useState(MAX_GAME_TIME);
  const [gameOverReason, setGameOverReason] = useState('crash'); // 'crash' or 'timeout'
  const requestRef = useRef();
  const displayedTimeRef = useRef(MAX_GAME_TIME);
  
  // Game Assets & Config
  const assets = useRef({
    particles: [],
    bgOffset: 0,
    stars: Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 2,
      speed: Math.random() * 0.5 + 0.1
    }))
  });

  const config = {
    gravity: 0.6,
    jumpStrength: -12, // Stronger jump for snappier feel
    speedInitial: 7,
    speedMax: 15,
    obstacleInterval: 1400
  };

  const game = useRef({
    player: { x: 50, y: 0, w: 30, h: 30, dy: 0, grounded: false, color: '#0ea5e9', rotation: 0 },
    obstacles: [],
    coins: [],
    speed: config.speedInitial,
    lastObstacleTime: 0,
    score: 0,
    sparks: 0,
    combo: 1,
    frameCount: 0,
    timeLeft: MAX_GAME_TIME,
    lastFrameTime: 0
  });

  // Cleanup on Unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Resize Handler
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
        
        // Regenerate stars on resize
        assets.current.stars = Array.from({ length: 50 }, () => ({
          x: Math.random() * clientWidth,
          y: Math.random() * clientHeight,
          size: Math.random() * 2,
          speed: Math.random() * 0.5 + 0.1
        }));

        // Reset player y to avoid falling through floor on resize
        if (game.current.player.y > clientHeight - 50) {
           game.current.player.y = clientHeight - 100;
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial sizing
    
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Run once on mount

  const startGame = () => {
    if (!canvasRef.current) return;
    
    setGameState('playing');
    setScore(0);
    setSparks(0);
    setCombo(1);
    setTimeLeft(MAX_GAME_TIME);
    displayedTimeRef.current = MAX_GAME_TIME;
    
    const height = canvasRef.current.height;

    game.current = {
      player: { x: 50, y: height - 100, w: 30, h: 30, dy: 0, grounded: false, color: '#0ea5e9', rotation: 0 },
      obstacles: [],
      coins: [],
      speed: config.speedInitial,
      lastObstacleTime: Date.now(),
      score: 0,
      sparks: 0,
      combo: 1,
      frameCount: 0,
      timeLeft: MAX_GAME_TIME,
      lastFrameTime: 0
    };
    
    assets.current.particles = [];

    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const drawCyberpunkBackground = (ctx, width, height) => {
    // 1. Dark Void Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#020617'); // Slate 950
    gradient.addColorStop(0.5, '#0f172a'); // Slate 900
    gradient.addColorStop(1, '#1e1b4b'); // Indigo 950
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Parallax Stars
    ctx.fillStyle = '#ffffff';
    assets.current.stars.forEach(star => {
      ctx.globalAlpha = Math.random() * 0.5 + 0.3;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
      star.x -= star.speed * (game.current.speed * 0.1); // Move with game speed
      if (star.x < 0) star.x = width; // Wrap around
    });
    ctx.globalAlpha = 1;

    // 3. Grid Perspective (Retro Wave style)
    ctx.save();
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.2)'; // Pinkish grid
    ctx.lineWidth = 1;
    
    const gridSize = 60;
    const horizonY = height * 0.8; // Horizon line
    const perspectiveOrigin = { x: width / 2, y: horizonY * 0.2 }; // Vanishing point
    
    // Vertical Lines (Perspective)
    // Simplified: Moving vertical lines
    const offset = (assets.current.bgOffset * 0.8) % gridSize;
    ctx.beginPath();
    for (let x = -offset; x < width + gridSize; x += gridSize) {
        // Draw vertical lines creating a sense of speed
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }
    
    // Horizontal Lines (Floor perception)
    for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();
    
    // 4. Distant City Skyline (Silhouette)
    // Simple block shapes in the background moving slowly
    // (Omitted for performance, keeping it clean)

    ctx.restore();

    assets.current.bgOffset += game.current.speed * 0.5;
  };

  const createExplosion = (x, y, color) => {
    for (let i = 0; i < 12; i++) {
      assets.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02,
        color
      });
    }
  };

  const handleGameOver = useCallback((reason = 'crash') => {
    setGameOverReason(reason);
    setGameState('gameover');
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (onGameOver) onGameOver(Math.floor(game.current.score), game.current.sparks);
  }, [onGameOver]);

  const gameLoop = useCallback((timestamp) => {
    if (gameState !== 'playing') return;
    if (!canvasRef.current) return;

    // --- TIMER LOGIC ---
    if (!game.current.lastFrameTime) game.current.lastFrameTime = timestamp;
    const deltaTime = (timestamp - game.current.lastFrameTime) / 1000;
    game.current.lastFrameTime = timestamp;

    // Prevent huge jumps if tab switched (max 0.5s)
    if (deltaTime > 0 && deltaTime < 0.5) {
        game.current.timeLeft -= deltaTime;
    }
    
    if (game.current.timeLeft <= 0) {
        game.current.timeLeft = 0;
        handleGameOver('timeout');
        return;
    }

    // Sync UI Timer (throttled)
    const currentIntTime = Math.ceil(game.current.timeLeft);
    if (currentIntTime !== displayedTimeRef.current) {
        displayedTimeRef.current = currentIntTime;
        setTimeLeft(currentIntTime);
    }

    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    // --- UPDATE LOGIC ---
    const p = game.current.player;
    
    // Physics
    p.dy += config.gravity;
    p.y += p.dy;
    p.rotation += 0.15; // Faster rotation

    const isMobile = width < 768;
    const floorHeight = 60;
    const uiReservedBottom = isMobile ? 100 : 0;

    // Ground Collision
    const floorY = height - floorHeight - uiReservedBottom;
    if (p.y + p.h > floorY) {
        p.y = floorY - p.h;
        p.dy = 0;
        p.grounded = true;
        p.rotation = 0; // Reset rotation on ground
    } else {
        p.grounded = false;
    }

    // Speed Progression
    game.current.speed = Math.min(config.speedMax, game.current.speed + 0.002);

    // Spawn Obstacles
    const currentInterval = config.obstacleInterval / (game.current.speed / config.speedInitial);
    if (Date.now() - game.current.lastObstacleTime > currentInterval) {
        const type = Math.random() > 0.65 ? 'drone' : 'wall';
        // Varied heights for walls
        const obsH = type === 'wall' ? 40 + Math.random() * 60 : 30;
        // Drones fly at different heights
        const obsY = type === 'drone' ? floorY - 50 - Math.random() * 100 : floorY - obsH;
        
        game.current.obstacles.push({
            x: width,
            y: obsY,
            w: 30,
            h: obsH,
            type,
            passed: false,
            pulseOffset: Math.random() * Math.PI // For visual effect
        });

        // Spawn Coins (Sparks)
        if (Math.random() > 0.3) {
            // Clusters of coins
            const coinPattern = Math.random() > 0.5 ? 1 : 3;
            for(let k=0; k<coinPattern; k++) {
                game.current.coins.push({
                    x: width + 50 + (k * 40) + Math.random() * 20,
                    y: type === 'drone' ? floorY - 20 : floorY - 120 - Math.random() * 50,
                    w: 14,
                    h: 14,
                    active: true,
                    pulse: 0
                });
            }
        }

        game.current.lastObstacleTime = Date.now();
    }

    // Update Obstacles
    for (let i = game.current.obstacles.length - 1; i >= 0; i--) {
        const obs = game.current.obstacles[i];
        obs.x -= game.current.speed;

        // Precise Collision Detection (AABB)
        // Shrink hitboxes slightly for fair play
        const hitX = obs.x + 5;
        const hitY = obs.y + 5;
        const hitW = obs.w - 10;
        const hitH = obs.h - 10;
        
        const pX = p.x + 5;
        const pY = p.y + 5;
        const pW = p.w - 10;
        const pH = p.h - 10;

        if (
            pX < hitX + hitW &&
            pX + pW > hitX &&
            pY < hitY + hitH &&
            pY + pH > hitY
        ) {
            handleGameOver('crash');
            return; // Stop loop immediately
        }

        // Score
        if (!obs.passed && obs.x + obs.w < p.x) {
            obs.passed = true;
            game.current.score += 10 * game.current.combo;
            setScore(Math.floor(game.current.score));
        }

        if (obs.x + obs.w < -100) game.current.obstacles.splice(i, 1);
    }

    // Update Coins
    for (let i = game.current.coins.length - 1; i >= 0; i--) {
        const coin = game.current.coins[i];
        coin.x -= game.current.speed;
        coin.pulse += 0.15;

        // Collision
        if (
            coin.active &&
            p.x < coin.x + coin.w + 5 && // Forgiving hitbox
            p.x + p.w > coin.x - 5 &&
            p.y < coin.y + coin.h + 5 &&
            p.y + p.h > coin.y - 5
        ) {
            coin.active = false;
            createExplosion(coin.x, coin.y, '#facc15');
            game.current.sparks += 1;
            game.current.combo = Math.min(game.current.combo + 0.1, 5); // Max combo 5x
            setSparks(game.current.sparks);
            setCombo(game.current.combo);
            game.current.coins.splice(i, 1);
            continue;
        }

        if (coin.x < -50) game.current.coins.splice(i, 1);
    }

    // Update Particles
    for (let i = assets.current.particles.length - 1; i >= 0; i--) {
        const part = assets.current.particles[i];
        part.x += part.vx;
        part.y += part.vy;
        part.life -= part.decay;
        if (part.life <= 0) assets.current.particles.splice(i, 1);
    }

    // --- DRAW LOGIC ---
    drawCyberpunkBackground(ctx, width, height);

    // Draw Floor
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#d946ef'; // Fuchsia glow
    const gradientFloor = ctx.createLinearGradient(0, floorY, 0, floorY + floorHeight);
    gradientFloor.addColorStop(0, '#701a75');
    gradientFloor.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradientFloor;
    ctx.fillRect(0, floorY, width, floorHeight);
    
    // Floor Neon Line
    ctx.fillStyle = '#e879f9'; // Pink-purple
    ctx.fillRect(0, floorY, width, 3);
    ctx.shadowBlur = 0;

    // Draw Player
    ctx.save();
    ctx.translate(p.x + p.w/2, p.y + p.h/2);
    if (!p.grounded) ctx.rotate(p.rotation);
    
    // Robot Body (Neon Style)
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#0ea5e9'; // Sky blue glow
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
    
    // Inner Detail
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-p.w/4, -p.h/4, p.w/2, p.h/2);

    // Robot Eye (Trail effect)
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    ctx.fillRect(4, -6, 10, 4);
    
    ctx.restore();

    // Draw Obstacles
    game.current.obstacles.forEach(obs => {
        ctx.shadowBlur = 15;
        
        if (obs.type === 'drone') {
            ctx.shadowColor = '#f43f5e'; // Rose
            ctx.fillStyle = '#f43f5e';
            
            // Drone shape (Diamond)
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y + obs.h/2);
            ctx.lineTo(obs.x + obs.w/2, obs.y);
            ctx.lineTo(obs.x + obs.w, obs.y + obs.h/2);
            ctx.lineTo(obs.x + obs.w/2, obs.y + obs.h);
            ctx.fill();
            
            // Center pulsing light
            const pulse = Math.sin(Date.now() / 100 + obs.pulseOffset) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.beginPath();
            ctx.arc(obs.x + obs.w/2, obs.y + obs.h/2, 4, 0, Math.PI * 2);
            ctx.fill();

        } else {
            // Wall (Cyber block)
            ctx.shadowColor = '#f97316'; // Orange
            ctx.fillStyle = '#ea580c';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            
            // Neon edges
            ctx.strokeStyle = '#fdba74';
            ctx.lineWidth = 2;
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
            
            // Digital markings
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(obs.x + 5, obs.y + 10, obs.w - 10, 4);
            ctx.fillRect(obs.x + 5, obs.y + 20, obs.w - 10, 4);
        }
        ctx.shadowBlur = 0;
    });

    // Draw Coins
    game.current.coins.forEach(coin => {
        if (!coin.active) return;
        const scale = 1 + Math.sin(coin.pulse) * 0.2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#facc15';
        ctx.fillStyle = '#facc15';
        
        ctx.save();
        ctx.translate(coin.x + coin.w/2, coin.y + coin.h/2);
        ctx.scale(scale, scale);
        
        // Hexagon shape for Sparks
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.lineTo(coin.w/2 * Math.cos(i * Math.PI / 3), coin.w/2 * Math.sin(i * Math.PI / 3));
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        ctx.shadowBlur = 0;
    });

    // Draw Particles
    assets.current.particles.forEach(part => {
        ctx.globalAlpha = part.life;
        ctx.fillStyle = part.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = part.color;
        ctx.fillRect(part.x, part.y, 3, 3);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    });

    // Loop
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, handleGameOver]); // Dependencies for useCallback

  // Effect to trigger loop when state changes to playing
  useEffect(() => {
    if (gameState === 'playing') {
        game.current.lastFrameTime = 0; // Reset delta tracker
        requestRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, gameLoop]);


  const handleJump = (e) => {
    if (e && e.type === 'touchstart') {
       // e.preventDefault(); // Prevent scrolling on mobile
    }
    
    if (gameState !== 'playing') return;

    if (game.current.player.grounded) {
      game.current.player.dy = config.jumpStrength;
      game.current.player.grounded = false;
      // Add jump particles
      createExplosion(game.current.player.x + 15, game.current.player.y + 30, '#0ea5e9');
    }
  };

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
          if (gameState === 'playing') handleJump();
      }
      if (e.code === 'Escape') {
          if (gameState === 'playing') setGameState('paused');
          else if (gameState === 'paused') {
              setGameState('playing');
          }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center font-mono animate-fadeIn select-none overflow-hidden touch-none">
      
      {/* SAFE EXIT BUTTON (Always Visible) */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-[110] bg-red-600/20 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur transition-colors border border-red-500/30"
        title="Force Exit"
      >
        <XCircle size={24} />
      </button>

      {/* HUD */}
      {gameState === 'playing' && (
          <div className="absolute top-4 left-4 right-16 flex justify-between items-start z-10 pointer-events-none">
            <div className="flex flex-col gap-1">
                <div className="bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border-l-4 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    <p className="text-[10px] text-blue-400 font-bold tracking-widest">SCORE</p>
                    <p className="text-3xl font-black text-white leading-none tracking-tighter filter drop-shadow-md">{Math.floor(score).toString().padStart(6, '0')}</p>
                </div>
            </div>
            
            <div className="flex gap-2">
                <div className="bg-gray-900/80 backdrop-blur px-3 py-1 rounded border border-cyan-500/30 flex flex-col items-center shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1"><Clock size={10} /> TIME</span>
                    <span className={`text-lg font-bold ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        {Math.floor(timeLeft)}s
                    </span>
                </div>

                <div className="bg-gray-900/80 backdrop-blur px-3 py-1 rounded border border-yellow-500/30 flex flex-col items-center shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                    <span className="text-[10px] text-yellow-400 font-bold flex items-center gap-1"><Zap size={10} /> MULTI</span>
                    <span className="text-lg font-bold text-white">x{combo.toFixed(1)}</span>
                </div>
                <div className="bg-gray-900/80 backdrop-blur px-3 py-1 rounded border border-purple-500/30 flex flex-col items-center shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                    <span className="text-[10px] text-purple-400 font-bold flex items-center gap-1"><ShieldCheck size={10} /> SPARKS</span>
                    <span className="text-lg font-bold text-white">{sparks}</span>
                </div>
            </div>
            
            {/* Pause Button in HUD */}
            <button 
                onClick={() => setGameState('paused')} 
                className="pointer-events-auto bg-gray-800/80 p-2 rounded-full text-white hover:bg-gray-700 transition border border-gray-600 ml-2"
            >
                <Pause size={24} />
            </button>
          </div>
      )}

      {/* CANVAS LAYER */}
      <canvas 
        ref={canvasRef}
        className="block w-full h-full object-cover"
        onPointerDown={handleJump} // Primary touch interaction
      />

      {/* OVERLAYS */}
      
      {/* MENU INICIAL */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md z-20">
          <div className="mb-10 relative">
             <div className="absolute inset-0 bg-fuchsia-500 blur-[60px] opacity-30 animate-pulse"></div>
             <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-fuchsia-400 to-purple-500 italic tracking-tighter relative z-10 transform -skew-x-12 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]">
                QUANTUM<br/>DASH
             </h1>
             <p className="text-cyan-400 mt-2 font-bold tracking-[0.5em] text-xs uppercase glow-text">Neon Endless Runner</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-10 w-full max-w-sm">
             <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700/50 backdrop-blur flex flex-col items-center hover:bg-gray-800/80 transition">
               <Trophy className="text-yellow-400 mb-2" size={24} />
               <p className="text-[10px] text-gray-500 font-bold uppercase">Recorde</p>
               <p className="text-2xl text-white font-black">{highScore}</p>
             </div>
             <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700/50 backdrop-blur flex flex-col items-center hover:bg-gray-800/80 transition">
               <Zap className="text-purple-400 mb-2" size={24} />
               <p className="text-[10px] text-gray-500 font-bold uppercase">Sparks</p>
               <p className="text-2xl text-white font-black">{userSparks}</p>
             </div>
          </div>

          <button 
            onClick={startGame}
            className="w-full max-w-sm bg-gradient-to-r from-blue-600 to-fuchsia-600 hover:from-blue-500 hover:to-fuchsia-500 text-white font-black text-xl py-6 rounded-2xl shadow-[0_0_40px_rgba(217,70,239,0.4)] border-b-4 border-fuchsia-900 active:border-b-0 active:mt-1 transition-all flex items-center justify-center gap-3 mb-4 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
            <Play size={28} className="fill-current group-hover:scale-110 transition-transform" /> START RUN
          </button>
          
          <button onClick={onClose} className="text-gray-500 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-wide py-4 px-8 rounded-full hover:bg-white/5 transition">
             <ArrowLeft size={16} /> Voltar ao Hub
          </button>
        </div>
      )}

      {/* GAME OVER */}
      {gameState === 'gameover' && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-lg z-20 animate-in fade-in duration-300 ${gameOverReason === 'timeout' ? 'bg-blue-950/90' : 'bg-red-950/90'}`}>
          <h2 className="text-6xl font-black text-white mb-2 tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] glitch-text">
             {gameOverReason === 'timeout' ? 'COMPLETE!' : 'CRASHED!'}
          </h2>
          <p className={`mb-8 font-mono text-sm border px-3 py-1 rounded uppercase ${gameOverReason === 'timeout' ? 'text-blue-300 border-blue-500/30 bg-blue-900/50' : 'text-red-300 border-red-500/30 bg-red-900/50'}`}>
             {gameOverReason === 'timeout' ? 'MAXIMUM TIME REACHED' : 'SYSTEM FAILURE DETECTED'}
          </p>
          
          <div className={`bg-black/60 p-6 rounded-2xl border w-full max-w-sm mb-8 shadow-2xl relative overflow-hidden ${gameOverReason === 'timeout' ? 'border-blue-500/30' : 'border-red-500/30'}`}>
             <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent to-transparent animate-scan ${gameOverReason === 'timeout' ? 'via-blue-500' : 'via-red-500'}`}></div>
             <div className="flex justify-between items-end mb-4 border-b border-white/10 pb-4">
               <span className="text-gray-400 text-xs font-bold uppercase">Session Score</span>
               <span className="text-4xl font-black text-white">{Math.floor(score)}</span>
             </div>
             <div className="flex justify-between items-end">
               <span className="text-gray-400 text-xs font-bold uppercase">Sparks</span>
               <span className="text-3xl font-black text-yellow-400 flex items-center gap-2">
                 <Zap size={24} fill="currentColor" /> +{sparks}
               </span>
             </div>
          </div>

          <button 
            onClick={startGame}
            className="w-full max-w-sm bg-white text-gray-900 hover:bg-gray-100 font-black text-lg py-5 rounded-2xl shadow-lg border-b-4 border-gray-400 active:border-b-0 active:mt-1 transition-all flex items-center justify-center gap-2 mb-4"
          >
            <RefreshCw size={24} /> REBOOT SYSTEM
          </button>
          
          <button onClick={onClose} className="text-white/60 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-wide py-2">
             <ArrowLeft size={16} /> Voltar ao Hub
          </button>
        </div>
      )}

      {/* PAUSED */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md z-20">
           <h2 className="text-5xl font-black text-white mb-10 tracking-widest border-b-4 border-blue-500 pb-2">PAUSED</h2>
           <button 
            onClick={() => {
                setGameState('playing');
            }}
            className="w-full max-w-xs bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] mb-4 flex items-center justify-center gap-2"
           >
             <Play size={20} fill="currentColor" /> RESUME
           </button>
           <button 
             onClick={onClose} 
             className="w-full max-w-xs bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-xl border border-gray-700 flex items-center justify-center gap-2"
           >
             <ArrowLeft size={20} /> QUIT GAME
           </button>
        </div>
      )}
    </div>
  );
};
