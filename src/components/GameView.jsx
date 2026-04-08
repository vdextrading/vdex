import React, { useState } from 'react';
import { Gamepad2, Zap, Trophy, Play, Lock, AlertTriangle, Battery } from 'lucide-react';
import { CONFIG } from '../data/config';
import { QuantumDash } from './QuantumDash';
import { VaultHacker } from './VaultHacker';

// HUB DE JOGOS
export const GameView = ({ t, user, handleGamePlay, handleQuantumGameOver, handleVaultResult, handleBuyCredits, formatVDT }) => {
  const [activeGame, setActiveGame] = useState(null); // null (hub), 'vault', 'quantum'

  const games = [
    {
      id: 'quantum',
      name: 'QUANTUM DASH',
      desc: 'Corra, desvie e colete Sparks no cyberespaço.',
      icon: <Zap size={32} className="text-yellow-400" />,
      color: 'border-yellow-500',
      bg: 'bg-yellow-500/10',
      credits: user.gameCredits?.daily || 0,
      cost: '1 ENERGY',
      action: () => {
         if (user.gameCredits?.daily > 0) {
             setActiveGame('quantum');
             // Consumo de crédito será processado no GameOver ou StartGame real, 
             // mas por simplicidade aqui apenas abrimos. O consumo real deve ser gerido pelo App.jsx
         } else {
             // Trigger modal de compra
             handleBuyCredits(); 
         }
      }
    },
    {
      id: 'vault',
      name: 'VAULT HACKER',
      desc: 'Desafie a sorte e dobre seus VDTs.',
      icon: <Gamepad2 size={32} className="text-purple-500" />,
      color: 'border-purple-500',
      bg: 'bg-purple-500/10',
      cost: `${CONFIG.gameCost} VDT`,
      action: () => setActiveGame('vault')
    }
  ];

  if (activeGame === 'vault') {
    return (
      <VaultHacker 
        onClose={() => setActiveGame(null)} 
        onResult={handleVaultResult}
        userBalance={user.balances.vdt}
      />
    );
  }

  if (activeGame === 'quantum') {
    return (
      <QuantumDash 
        onClose={() => setActiveGame(null)} 
        onGameOver={(score, sparks) => handleQuantumGameOver(score, sparks)}
        highScore={user.quantumStats?.highScore || 0}
        userSparks={user.quantumStats?.totalSparks || 0}
      />
    );
  }

  return (
    <div className="px-4 pb-24 pt-4 animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            GAME <span className="text-blue-500">CENTER</span>
          </h2>
          <p className="text-gray-400 text-xs">Jogue e ganhe recompensas reais</p>
        </div>
        <div className="bg-gray-800 px-3 py-1 rounded-full border border-gray-700 flex items-center gap-2">
           <Trophy size={14} className="text-yellow-400" />
           <span className="text-white font-bold text-sm">RANK #42</span>
        </div>
      </div>

      {/* Energy Status */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 rounded-xl border border-gray-700 mb-6 flex justify-between items-center">
         <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
               <Battery size={24} className={user.gameCredits?.daily > 0 ? "text-blue-400" : "text-red-400"} />
            </div>
            <div>
               <p className="text-gray-400 text-xs uppercase font-bold">Daily Energy</p>
               <p className="text-white font-bold text-lg">{user.gameCredits?.daily || 0}/3</p>
            </div>
         </div>
         <button 
           onClick={handleBuyCredits}
           className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg border-b-2 border-blue-800 active:border-b-0 active:mt-1 transition-all"
         >
           REFILL +
         </button>
      </div>

      {/* FDT Token Card (Game Context) */}
      <div className="bg-gray-800 p-4 rounded-xl border border-yellow-400/30 mb-6 relative overflow-hidden shadow-lg">
        {/* Background Effect */}
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-500/10 rounded-full blur-xl animate-pulse"></div>
        
        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/20 p-3 rounded-xl border border-yellow-500/30">
              <Trophy size={24} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-400 font-bold text-lg leading-none">VDT Token</p>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">Game Balance</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-mono text-2xl font-bold tracking-tight drop-shadow-md">
              {formatVDT ? formatVDT(user.balances.vdt) : `${user.balances.vdt} VDT`}
            </p>
            <p className="text-[10px] text-gray-500 font-mono mt-1 bg-black/20 px-2 py-0.5 rounded-full inline-block">
              100 VDT ≈ $1.00
            </p>
          </div>
        </div>
      </div>

      {/* Game Grid */}
      <div className="grid grid-cols-1 gap-4">
        {games.map(game => (
           <div key={game.id} className={`bg-gray-800 rounded-xl overflow-hidden border-l-4 ${game.color} relative group transition-all hover:scale-[1.02] flex flex-col h-full`}>
              <div className="p-5 flex-1 relative z-10">
                 <div className="flex gap-4 items-start">
                    <div className={`shrink-0 w-14 h-14 rounded-lg ${game.bg} flex items-center justify-center border border-white/5`}>
                       {game.icon}
                    </div>
                    <div className="min-w-0">
                       <h3 className="text-white font-black text-lg italic tracking-wider truncate">{game.name}</h3>
                       <p className="text-gray-400 text-xs leading-relaxed mb-3 line-clamp-2">{game.desc}</p>
                       <span className="inline-block text-[10px] bg-gray-900 px-2 py-1 rounded text-gray-300 border border-gray-700 font-mono">
                          COST: <span className="text-white font-bold">{game.cost}</span>
                       </span>
                    </div>
                 </div>
              </div>
              
              {/* Play Button Overlay */}
              <div className="bg-gray-900/50 p-3 flex justify-end border-t border-gray-700/50 mt-auto relative z-20">
                 <button 
                   onClick={game.action}
                   className="bg-white text-gray-900 font-bold text-sm px-6 py-2 rounded-full shadow-lg hover:bg-gray-200 transition flex items-center gap-1 active:scale-95"
                 >
                   JOGAR <Play size={12} fill="currentColor" />
                 </button>
              </div>

              {/* Background Effect */}
              <div className={`absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white/5 to-transparent skew-x-12 transform translate-x-8 group-hover:translate-x-4 transition duration-500 pointer-events-none`}></div>
           </div>
        ))}
      </div>

      {/* Weekly Ranking Teaser */}
      <div className="mt-8">
         <h3 className="text-gray-400 text-sm font-bold mb-3 flex items-center gap-2">
            <Trophy size={14} className="text-yellow-500" /> RANKING SEMANAL
         </h3>
         <div className="bg-gray-800 rounded-lg p-1 space-y-1">
            {[
               { name: 'CyberKing', score: 45020, pos: 1 },
               { name: 'NeonRider', score: 38900, pos: 2 },
               { name: 'TraderX', score: 32150, pos: 3 },
            ].map((r, i) => (
               <div key={i} className={`flex justify-between items-center p-3 rounded ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-gray-700/30'}`}>
                  <div className="flex items-center gap-3">
                     <span className={`font-black font-mono w-6 text-center ${i === 0 ? 'text-yellow-400 text-lg' : 'text-gray-500'}`}>#{r.pos}</span>
                     <span className="text-white text-sm font-bold">{r.name}</span>
                  </div>
                  <span className="text-gray-300 text-xs font-mono">{r.score.toLocaleString()}</span>
               </div>
            ))}
            <div className="p-2 text-center text-xs text-gray-500">
               ...
            </div>
            <div className="flex justify-between items-center p-3 rounded bg-blue-900/20 border border-blue-500/30">
               <div className="flex items-center gap-3">
                  <span className="font-black font-mono w-6 text-center text-blue-400">#42</span>
                  <span className="text-white text-sm font-bold">Você</span>
               </div>
               <span className="text-gray-300 text-xs font-mono">{(user.quantumStats?.highScore || 0).toLocaleString()}</span>
            </div>
         </div>
      </div>
    </div>
  );
};
