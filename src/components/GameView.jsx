import React, { useMemo, useState } from 'react';
import { Gamepad2, Zap, Trophy, Play, AlertTriangle, Battery, FileText, X } from 'lucide-react';
import { CONFIG } from '../data/config';
import { PlatformRunner } from './PlatformRunner';
import { QuantumDash } from './QuantumDash';
import { VaultHacker } from './VaultHacker';

// HUB DE JOGOS
export const GameView = ({ t, user, gameEvents, handleConsumeEnergy, handleQuantumGameOver, handleVaultResult, handleBuyEnergy, formatVDT }) => {
  const [activeGame, setActiveGame] = useState(null); // null (hub), 'vault', 'quantum', 'runner'
  const [energyShopOpen, setEnergyShopOpen] = useState(false);
  const [energyBuyAmount, setEnergyBuyAmount] = useState(3);
  const [energyBuying, setEnergyBuying] = useState(false);

  const energyUnitPrice = useMemo(() => Number(CONFIG.energyUnitPriceVDT) || 5, []);
  const energyPacks = useMemo(() => [1, 3, 10], []);

  const games = [
    {
      id: 'runner',
      name: t.gameRunnerName || 'PLATFORM RUNNER',
      desc: t.gameRunnerDesc || 'Jump, dodge and collect Sparks.',
      icon: <Zap size={32} className="text-yellow-400" />,
      color: 'border-yellow-500',
      bg: 'bg-yellow-500/10',
      cost: '1 ENERGY',
      action: () => setActiveGame('runner')
    },
    {
      id: 'quantum',
      name: t.gameQuantumName || 'QUANTUM DASH',
      desc: t.gameQuantumDesc || 'Run and collect Sparks in cyberspace.',
      icon: <Zap size={32} className="text-blue-400" />,
      color: 'border-blue-500',
      bg: 'bg-blue-500/10',
      cost: '1 ENERGY',
      action: () => setActiveGame('quantum')
    },
    {
      id: 'vault',
      name: 'VAULT HACKER',
      desc: 'Desafie a sorte e dobre seus VDTs.',
      icon: <Gamepad2 size={32} className="text-purple-500" />,
      color: 'border-purple-500',
      bg: 'bg-purple-500/10',
      cost: '1 ENERGY',
      action: () => setActiveGame('vault')
    }
  ];

  if (activeGame === 'vault') {
    return (
      <VaultHacker 
        onClose={() => setActiveGame(null)} 
        onResult={handleVaultResult}
        onConsumeEnergy={() => (typeof handleConsumeEnergy === 'function' ? handleConsumeEnergy('vault') : true)}
      />
    );
  }

  if (activeGame === 'runner') {
    return (
      <PlatformRunner 
        t={t}
        onClose={() => setActiveGame(null)} 
        onGameOver={(score, sparks) => handleQuantumGameOver('runner', score, sparks)}
        onConsumeEnergy={() => (typeof handleConsumeEnergy === 'function' ? handleConsumeEnergy('runner') : true)}
        highScore={user.quantumStats?.highScore || 0}
        userSparks={user.quantumStats?.totalSparks || 0}
      />
    );
  }

  if (activeGame === 'quantum') {
    return (
      <QuantumDash 
        onClose={() => setActiveGame(null)} 
        onGameOver={(score, sparks) => handleQuantumGameOver('quantum', score, sparks)}
        onConsumeEnergy={() => (typeof handleConsumeEnergy === 'function' ? handleConsumeEnergy('quantum') : true)}
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
          <p className="text-gray-400 text-xs">{t.gameTagline || 'Play and earn real rewards'}</p>
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
               <p className="text-gray-400 text-xs uppercase font-bold">{t.gameDailyEnergy || 'Daily Energy'}</p>
               <p className="text-white font-bold text-lg">{user.gameCredits?.daily || 0}</p>
               <p className="text-gray-500 text-[10px] font-mono">{t.gameEnergyDailyBase || `Daily base: ${CONFIG.gameEnergyMax || 3}`}</p>
            </div>
         </div>
         <button 
           onClick={() => setEnergyShopOpen(true)}
           className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg border-b-2 border-blue-800 active:border-b-0 active:mt-1 transition-all"
         >
           {t.gameRefill || 'REFILL +'}
         </button>
      </div>

      {energyShopOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-700 p-6 animate-slideUp">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-white font-black text-lg">{t.energyShopTitle || 'ENERGY SHOP'}</div>
                <div className="text-xs text-gray-400">{t.energyShopSubtitle || `1 ENERGY = ${energyUnitPrice} VDT`}</div>
              </div>
              <button
                onClick={() => {
                  if (energyBuying) return;
                  setEnergyShopOpen(false);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X />
              </button>
            </div>

            <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-4 flex justify-between items-center">
              <div className="text-xs text-gray-400">{t.energyShopBalance || 'VDT Balance'}</div>
              <div className="text-white font-black font-mono">{formatVDT ? formatVDT(user.balances.vdt) : `${user.balances.vdt} VDT`}</div>
            </div>

            <div className="mt-3 bg-gray-800/60 rounded-xl border border-gray-700 p-4">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{t.energyShopEnergyNow || 'Energy now'}</span>
                <span className="text-white font-black font-mono">{Number(user.gameCredits?.daily) || 0} {t.gameEnergyUnit || 'ENERGY'}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>{t.energyShopEnergyAfter || 'After purchase'}</span>
                <span className="text-green-400 font-black font-mono">{(Number(user.gameCredits?.daily) || 0) + (Number(energyBuyAmount) || 0)} {t.gameEnergyUnit || 'ENERGY'}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {energyPacks.map((n) => {
                const cost = n * energyUnitPrice;
                const active = energyBuyAmount === n;
                return (
                  <button
                    key={n}
                    onClick={() => setEnergyBuyAmount(n)}
                    className={`rounded-xl border p-3 text-center transition ${
                      active ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700/40'
                    }`}
                    disabled={energyBuying}
                  >
                    <div className="text-sm font-black">+{n} {t.gameEnergyUnit || 'ENERGY'}</div>
                    <div className="text-[11px] font-mono text-gray-400">{cost} VDT</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  if (energyBuying) return;
                  setEnergyShopOpen(false);
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl border border-gray-700"
                disabled={energyBuying}
              >
                {t.energyShopCancel || 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  if (energyBuying) return;
                  setEnergyBuying(true);
                  try {
                    const res = await (typeof handleBuyEnergy === 'function' ? handleBuyEnergy(energyBuyAmount) : null);
                    if (res?.ok) setEnergyShopOpen(false);
                  } finally {
                    setEnergyBuying(false);
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg"
                disabled={energyBuying}
              >
                {energyBuying ? (t.energyShopBuying || 'Buying...') : (t.energyShopConfirm || 'Buy')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-700 mb-6 flex gap-3">
        <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed">
          <div className="text-white font-bold">{t.gameRewardsTitle || 'Game rewards are paid in VDT.'}</div>
          <div className="text-gray-400">{t.gameRewardsSubtitle || 'Conversion: 50 Sparks = 1 VDT. Automatic caps per round and per day.'}</div>
        </div>
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
                          {t.gameCostLabel || 'Cost'}: <span className="text-white font-bold">{game.cost}</span>
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
                   {(t.play || 'PLAY')} <Play size={12} fill="currentColor" />
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
            <Trophy size={14} className="text-yellow-500" /> {(t.gameWeeklyRanking || 'Weekly ranking').toUpperCase()}
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
                  <span className="text-white text-sm font-bold">{t.gameYou || 'You'}</span>
               </div>
               <span className="text-gray-300 text-xs font-mono">{(user.quantumStats?.highScore || 0).toLocaleString()}</span>
            </div>
         </div>
      </div>

      <div className="mt-8">
        <h3 className="text-gray-400 text-sm font-bold mb-3 flex items-center gap-2">
          <FileText size={14} className="text-blue-400" /> {(t.gameHistoryTitle || 'Game history').toUpperCase()}
        </h3>
        <div className="bg-gray-800 rounded-lg p-2 space-y-2 border border-gray-700">
          {(Array.isArray(gameEvents) ? gameEvents : []).slice(0, 8).map((ev) => {
            const ts = ev?.created_at ? new Date(ev.created_at).getTime() : Date.now();
            const date = new Date(ts).toLocaleString();
            const gameKey = String(ev?.game || '').toLowerCase();
            const game = (
              gameKey === 'runner' ? (t.gameRunnerName || 'PLATFORM RUNNER') :
              gameKey === 'quantum' ? (t.gameQuantumName || 'QUANTUM DASH') :
              gameKey === 'vault' ? 'VAULT' :
              gameKey === 'shop' ? 'SHOP' :
              String(ev?.game || '').toUpperCase()
            ) || 'GAME';
            const sparks = Number(ev?.sparks) || 0;
            const meta = ev?.meta && typeof ev.meta === 'object' ? ev.meta : {};
            const rawVdt = Number(ev?.vdt_amount) || 0;
            const shopCost = Number(meta?.total_cost_vdt ?? meta?.cost_vdt ?? 0) || 0;
            const vdt = rawVdt !== 0 ? rawVdt : (gameKey === 'shop' && shopCost > 0 ? -shopCost : 0);
            const energy = Number(ev?.energy_spent) || 0;
            return (
              <div key={ev.id || `${ts}_${game}`} className="flex justify-between items-center bg-gray-900/40 rounded p-3 border border-gray-700/50">
                <div className="min-w-0">
                  <div className="text-white text-sm font-bold truncate">{game}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{date}</div>
                  <div className="text-[10px] text-gray-500 mt-1 font-mono">
                    {energy > 0 ? `${energy} ${t.gameEnergyUnit || 'ENERGY'}` : null}
                    {energy > 0 && sparks > 0 ? ' · ' : null}
                    {sparks > 0 ? `${sparks} ${t.gameSparksUnit || 'Sparks'}` : null}
                  </div>
                </div>
                <div className={`text-sm font-black font-mono ${vdt > 0 ? 'text-green-400' : vdt < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {vdt > 0 ? `+${vdt.toFixed(4)} VDT` : vdt < 0 ? `-${Math.abs(vdt).toFixed(2)} VDT` : '0 VDT'}
                </div>
              </div>
            );
          })}
          {(!Array.isArray(gameEvents) || gameEvents.length === 0) && (
            <div className="text-center text-xs text-gray-500 py-6">{t.gameNoMatchesYet || 'No matches yet.'}</div>
          )}
        </div>
      </div>
    </div>
  );
};
