import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Unlock, AlertTriangle, Cpu, ShieldCheck, X } from 'lucide-react';
import { CONFIG } from '../data/config';

export const VaultHacker = ({ onClose, onResult, userBalance }) => {
  // Estados do Jogo: 'intro', 'playing', 'won', 'lost', 'processing'
  const [gameState, setGameState] = useState('intro');
  const [level, setLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [targetZone, setTargetZone] = useState({ start: 0, end: 0 });
  const [speed, setSpeed] = useState(2);
  const [direction, setDirection] = useState(1); // 1 = horário, -1 = anti-horário
  const [message, setMessage] = useState('');
  
  const requestRef = useRef();
  const rotationRef = useRef(0);
  
  const MAX_LEVELS = 3;
  const COST = CONFIG.gameCost || 50;
  const REWARD = COST * 2; // Dobra o valor apostado (lucro líquido = COST)

  // Configuração de Dificuldade por Nível
  const LEVEL_CONFIG = {
    1: { zoneSize: 60, speed: 3, color: 'text-green-400', borderColor: 'border-green-500' },
    2: { zoneSize: 45, speed: 5, color: 'text-yellow-400', borderColor: 'border-yellow-500' },
    3: { zoneSize: 30, speed: 7, color: 'text-red-500', borderColor: 'border-red-500' }
  };

  // Inicializar Nível
  const startLevel = useCallback((lvl) => {
    const config = LEVEL_CONFIG[lvl];
    const zoneStart = Math.random() * 260 + 50; // Evita zona no topo exato (0/360)
    
    setTargetZone({ 
      start: zoneStart, 
      end: zoneStart + config.zoneSize 
    });
    setSpeed(config.speed);
    setDirection(Math.random() > 0.5 ? 1 : -1);
    setRotation(0);
    rotationRef.current = 0;
    setMessage(`NÍVEL ${lvl}/${MAX_LEVELS}`);
  }, []);

  // Loop de Animação
  const animate = useCallback(() => {
    if (gameState !== 'playing') return;

    rotationRef.current = (rotationRef.current + (speed * direction)) % 360;
    if (rotationRef.current < 0) rotationRef.current += 360;
    
    setRotation(rotationRef.current);
    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, speed, direction]);

  useEffect(() => {
    if (gameState === 'playing') {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate, gameState]);

  // Ação de Hackear (Click/Tap)
  const handleHack = () => {
    if (gameState !== 'playing') return;

    const currentRot = rotationRef.current;
    // Normalizar rotação para comparar com zona (lidar com 360 -> 0)
    // Zona é contínua no range definido em startLevel
    
    const isHit = currentRot >= targetZone.start && currentRot <= targetZone.end;

    if (isHit) {
      handleSuccess();
    } else {
      handleFailure();
    }
  };

  const handleSuccess = () => {
    if (level < MAX_LEVELS) {
      setMessage('ACESSO PERMITIDO');
      setGameState('processing');
      setTimeout(() => {
        setLevel(l => l + 1);
        startLevel(level + 1);
        setGameState('playing');
      }, 1000);
    } else {
      finishGame(true);
    }
  };

  const handleFailure = () => {
    finishGame(false);
  };

  const finishGame = (win) => {
    setGameState(win ? 'won' : 'lost');
    if (win) {
        onResult(true, COST); // Ganhou (Lucro = COST)
    } else {
        onResult(false, COST); // Perdeu (Custo já debitado ou a debitar)
    }
  };

  const startGame = () => {
    if (userBalance < COST) {
        alert("Saldo Insuficiente!"); // Idealmente usar notificação do sistema
        return;
    }
    // Debitar custo inicial (ou sinalizar que começou)
    // Aqui assumimos que o onResult lida com o saldo final, 
    // mas para garantir, podemos debitar agora ou no final.
    // Vamos debitar visualmente no resultado para simplificar, 
    // mas o correto seria debitar no 'start'.
    // O componente pai vai gerenciar o saldo real.
    
    setLevel(1);
    startLevel(1);
    setGameState('playing');
  };

  // Renderização do Círculo
  const renderDial = () => {
    const radius = 100;
    const circumference = 2 * Math.PI * radius;
    
    // Calcular arco da zona alvo
    const zoneLength = LEVEL_CONFIG[level].zoneSize;
    const dashArray = `${(zoneLength / 360) * circumference} ${circumference}`;
    const dashOffset = -((targetZone.start / 360) * circumference);

    return (
      <div className="relative w-64 h-64 mx-auto my-8">
        {/* Fundo do Dial */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="128"
            cy="128"
            r="100"
            className="stroke-gray-800 fill-none stroke-[12]"
          />
          {/* Zona Alvo */}
          <circle
            cx="128"
            cy="128"
            r="100"
            className={`fill-none stroke-[12] transition-colors duration-300 ${
                gameState === 'won' ? 'stroke-green-400' :
                gameState === 'lost' ? 'stroke-red-500' :
                'stroke-blue-500 shadow-[0_0_15px_currentColor]'
            }`}
            style={{
              strokeDasharray: dashArray,
              strokeDashoffset: dashOffset,
              strokeLinecap: 'butt'
            }}
          />
        </svg>

        {/* Cursor Rotativo */}
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-8 bg-white rounded-full shadow-[0_0_15px_white]"></div>
        </div>

        {/* Centro com Status */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            {gameState === 'playing' || gameState === 'processing' ? (
                <>
                    <Lock size={32} className="text-gray-400 mb-2" />
                    <span className="text-2xl font-black font-mono text-white">{level}/{MAX_LEVELS}</span>
                </>
            ) : gameState === 'won' ? (
                <Unlock size={48} className="text-green-400 animate-bounce" />
            ) : gameState === 'lost' ? (
                <AlertTriangle size={48} className="text-red-500 animate-pulse" />
            ) : (
                <Cpu size={48} className="text-purple-500 animate-pulse" />
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-center animate-fadeIn p-4">
      {/* Header */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-gray-900 to-transparent">
        <div className="flex items-center gap-2">
            <Cpu className="text-purple-500" />
            <h2 className="font-mono font-bold text-white tracking-widest">VAULT HACKER v2.0</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition">
            <X className="text-gray-400" />
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="w-full max-w-md text-center">
        
        {gameState === 'intro' && (
            <div className="space-y-8 animate-slideUp">
                <div className="bg-gray-900 border border-purple-500/30 p-8 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-scan"></div>
                    <h1 className="text-4xl font-black text-white mb-2 font-mono">HACK THE VAULT</h1>
                    <p className="text-gray-400 text-sm mb-6">Quebre 3 níveis de segurança para dobrar sua aposta.</p>
                    
                    <div className="flex justify-center gap-4 text-sm font-mono">
                        <div className="bg-gray-800 px-4 py-2 rounded border border-gray-700">
                            <span className="block text-gray-500 text-xs">CUSTO</span>
                            <span className="text-red-400 font-bold">{COST} VDT</span>
                        </div>
                        <div className="bg-gray-800 px-4 py-2 rounded border border-green-500/30">
                            <span className="block text-gray-500 text-xs">PRÊMIO</span>
                            <span className="text-green-400 font-bold">{REWARD} VDT</span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={startGame}
                    disabled={userBalance < COST}
                    className={`w-full py-4 rounded-xl font-black text-xl tracking-widest transition-all transform hover:scale-105 ${
                        userBalance < COST 
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]'
                    }`}
                >
                    {userBalance < COST ? 'SALDO INSUFICIENTE' : 'INICIAR SISTEMA'}
                </button>
            </div>
        )}

        {(gameState === 'playing' || gameState === 'processing') && (
            <div className="animate-fadeIn">
                <div className={`text-xl font-mono font-bold mb-4 ${
                    gameState === 'processing' ? 'text-green-400' : 'text-white'
                }`}>
                    {message || 'AGUARDANDO INPUT...'}
                </div>
                
                {renderDial()}

                <button 
                    onMouseDown={handleHack}
                    onTouchStart={handleHack}
                    disabled={gameState === 'processing'}
                    className="w-full max-w-[200px] bg-white text-black font-black text-2xl py-6 rounded-2xl active:scale-95 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)] mx-auto block mt-8 hover:bg-gray-200"
                >
                    HACK
                </button>
                <p className="text-gray-500 text-xs mt-4 font-mono">TOQUE PARA TRAVAR O CÓDIGO</p>
            </div>
        )}

        {gameState === 'won' && (
            <div className="space-y-6 animate-bounceIn">
                <div className="bg-green-500/20 border border-green-500 p-8 rounded-2xl text-center">
                    <ShieldCheck size={64} className="text-green-400 mx-auto mb-4" />
                    <h2 className="text-3xl font-black text-white mb-2">ACESSO CONCEDIDO</h2>
                    <p className="text-green-300 font-mono">RECOMPENSA TRANSFERIDA</p>
                    <div className="text-5xl font-black text-white mt-4 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">
                        +{COST} VDT
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-xl border border-gray-600"
                >
                    FECHAR SISTEMA
                </button>
            </div>
        )}

        {gameState === 'lost' && (
            <div className="space-y-6 animate-shake">
                <div className="bg-red-500/20 border border-red-500 p-8 rounded-2xl text-center">
                    <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-3xl font-black text-white mb-2">FALHA DE SEGURANÇA</h2>
                    <p className="text-red-300 font-mono">SISTEMA BLOQUEADO</p>
                    <div className="text-xl font-bold text-gray-400 mt-4">
                        -{COST} VDT
                    </div>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={onClose}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-xl border border-gray-600"
                    >
                        SAIR
                    </button>
                    <button 
                        onClick={() => {
                            if (userBalance >= COST) {
                                setGameState('intro');
                                setTimeout(startGame, 100);
                            }
                        }}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg"
                    >
                        TENTAR NOVAMENTE
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
