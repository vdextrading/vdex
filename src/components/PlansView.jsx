import React, { useMemo, useState } from 'react';
import { PLANS } from '../data/config';
import { X, Check, AlertCircle, Wallet } from 'lucide-react';

export const PlansView = ({ t, handleActivatePlan, userBalance, user }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [amount, setAmount] = useState('');
  const planById = useMemo(() => {
    const map = new Map();
    (Array.isArray(PLANS) ? PLANS : []).forEach(p => map.set(p.id, p));
    return map;
  }, []);

  const openModal = (plan) => {
    setSelectedPlan(plan);
    setAmount(plan.min.toString());
  };

  const closeModal = () => {
    setSelectedPlan(null);
    setAmount('');
  };

  const handleConfirm = () => {
    if (!selectedPlan) return;
    const val = parseFloat(amount);
    if (isNaN(val) || val < selectedPlan.min || (selectedPlan.max && val > selectedPlan.max)) {
        // Validation handled by parent usually, but good to have UI feedback here
        return; 
    }
    handleActivatePlan(selectedPlan, val);
    closeModal();
  };

  // Cálculo dos saldos
  const saldoRestante = userBalance || 0;
  const saldoAplicado = Array.isArray(user?.activePlans) ? user.activePlans.reduce((acc, c) => acc + (Number(c.amount) || 0), 0) : 0;
  const saldoTotal = saldoRestante + saldoAplicado;
  const activePlans = Array.isArray(user?.activePlans) ? user.activePlans : [];

  return (
    <div className="px-4 pb-24 space-y-4 animate-fadeIn relative">
      <div className="flex items-center gap-2 mb-2">
         <h2 className="text-2xl font-bold text-white">{t.plansSelectStrategy}</h2>
         <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded border border-blue-700">{t.plansAiTrading}</span>
      </div>

      {/* Container de Saldos - Solicitado pelo usuário */}
      <div className="grid grid-cols-3 bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 opacity-50"></div>
          
          <div className="flex flex-col items-center justify-center border-r border-gray-800 pr-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{t.plansTotal}</span>
              <span className="text-white font-bold text-sm sm:text-base">${saldoTotal.toFixed(2)}</span>
          </div>

          <div className="flex flex-col items-center justify-center border-r border-gray-800 px-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{t.plansRemaining}</span>
              <span className="text-blue-400 font-bold text-sm sm:text-base">${saldoRestante.toFixed(2)}</span>
          </div>

          <div className="flex flex-col items-center justify-center pl-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{t.plansApplied}</span>
              <span className="text-green-400 font-bold text-sm sm:text-base">${saldoAplicado.toFixed(2)}</span>
          </div>
      </div>

      {activePlans.length > 0 && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-bold text-sm">{t.plansMyInvestments}</h3>
            <span className="text-[10px] text-gray-500 font-mono">{activePlans.length}</span>
          </div>
          <div className="space-y-3">
            {activePlans.map((c) => {
              const meta = planById.get(c.planId) || {};
              const totalDays = Number(meta.duration) || 0;
              const done = Number(c.businessDaysCompleted) || 0;
              const pct = totalDays > 0 ? Math.min(100, Math.max(0, (done / totalDays) * 100)) : 0;
              const left = totalDays > 0 ? Math.max(0, totalDays - done) : 0;
              const completed = totalDays > 0 && done >= totalDays;
              return (
                <div key={c.id} className="bg-gray-950/40 border border-gray-800 rounded-xl p-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{meta.name || c.planName || c.planId}</p>
                      <p className="text-[11px] text-gray-500">
                        ${Number(c.amount || 0).toFixed(2)} · {done}/{totalDays} {t.plansBusinessDays}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[11px] font-bold ${completed ? 'text-green-400' : 'text-yellow-300'}`}>
                        {completed ? t.plansCompleted : `${t.plansDaysLeft} ${left}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-4">
      {PLANS.map(plan => (
        <div 
          key={plan.id} 
          onClick={() => openModal(plan)}
          className={`bg-gray-800 border-l-4 ${plan.color} p-4 rounded-r-xl cursor-pointer hover:bg-gray-750 transition transform hover:translate-x-1 relative overflow-hidden group border-y border-r border-gray-700/50 flex flex-col h-full`}
        >
          {plan.highlight && (
            <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-bl-lg z-10">
              {t.plansPopular}
            </div>
          )}
          
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{plan.flag}</span>
              <div>
                <h3 className="text-white font-bold text-lg leading-tight">{plan.name}</h3>
                <span className="text-[10px] text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700 uppercase tracking-wide">
                  {plan.profile}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1">
            {plan.desc && (
                <p className="text-gray-400 text-xs mt-2 mb-3 leading-relaxed border-b border-gray-700/50 pb-2 whitespace-pre-line">
                {plan.desc}
                </p>
            )}

            <div className="flex justify-between items-end">
                <div>
                <p className="text-xs text-gray-500">{t.plansEstimatedTotalProfit}</p>
                <span className="text-green-400 font-black text-2xl drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]">
                    {plan.roiTotal}%
                </span>
                <p className="text-[10px] text-gray-400">{t.plansInDays} {plan.duration} {t.plansDays}</p>
                </div>

                <div className="text-right">
                <p className="text-[10px] text-gray-500 mb-1">{t.plansEntryMinMax}</p>
                <p className="text-white font-bold text-sm bg-gray-900/50 px-2 py-1 rounded inline-block border border-gray-700">
                    ${plan.min} - ${plan.max}
                </p>
                </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-700/50 flex justify-between items-center text-[10px]">
             <span className="text-green-400 font-bold bg-green-900/20 px-1.5 py-0.5 rounded border border-green-700/50">
                USUÁRIO: {plan.roiUser}%
             </span>
             <span className="text-blue-400 font-bold bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-700/50">
                ROBÔ: {plan.roiBot}%
             </span>
          </div>

          <div className="mt-3 flex items-center justify-between group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-blue-400">{t.plansCapitalPlusProfit}</span>
            <button className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-4 rounded shadow-lg transition">
              {t.plansActivate}
            </button>
          </div>
        </div>
      ))}
      </div>

      {/* INVESTMENT MODAL */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-gray-900 w-full max-w-sm rounded-2xl border border-gray-700 shadow-2xl overflow-hidden animate-slideUp max-h-[80dvh] sm:max-h-[90vh] overflow-y-auto">
                <div className={`p-4 ${selectedPlan.bg || 'bg-blue-600'} flex justify-between items-center`}>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        {selectedPlan.flag} {selectedPlan.name}
                    </h3>
                    <button onClick={closeModal} className="text-white/80 hover:text-white bg-black/20 rounded-full p-1">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm text-gray-400 font-bold uppercase">{t.plansDepositAmount}</label>
                            <span className="text-xs text-blue-400 flex items-center gap-1">
                                <Wallet size={12} /> {t.plansBalance}: ${userBalance?.toFixed(2)} (USDT + USDC)
                            </span>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                            <input 
                                type="number" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-xl py-4 pl-8 pr-4 text-white text-xl font-bold focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder={selectedPlan.min.toString()}
                            />
                        </div>
                        {parseFloat(amount) > userBalance && (
                            <p className="text-red-500 text-xs mt-2 flex items-center gap-1 animate-pulse">
                                <AlertCircle size={12} /> {t.plansInsufficientBalance}
                            </p>
                        )}
                         {parseFloat(amount) < selectedPlan.min && (
                            <p className="text-yellow-500 text-xs mt-2 flex items-center gap-1">
                                <AlertCircle size={12} /> {t.plansMin}: ${selectedPlan.min}
                            </p>
                        )}
                         {selectedPlan.max && parseFloat(amount) > selectedPlan.max && (
                            <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                                <AlertCircle size={12} /> {t.plansMax}: ${selectedPlan.max}
                            </p>
                        )}
                    </div>

                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 space-y-2">
                        <div className="flex justify-between text-sm border-b border-gray-700/50 pb-2 mb-2">
                            <span className="text-gray-400">{t.plansGrossProfit} ({selectedPlan.roiTotal}%)</span>
                            <span className="text-gray-300 font-bold">
                                +${((parseFloat(amount) || 0) * (selectedPlan.roiTotal/100)).toFixed(2)}
                            </span>
                        </div>
                        
                        <div className="flex justify-between text-xs text-blue-400">
                            <span>{t.plansBotFee} ({selectedPlan.roiBot}%)</span>
                            <span>-${((parseFloat(amount) || 0) * (selectedPlan.roiBot/100)).toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{t.plansUserProfit} ({selectedPlan.roiUser}%)</span>
                            <span className="text-green-400 font-bold">
                                +${((parseFloat(amount) || 0) * (selectedPlan.roiUser/100)).toFixed(2)}
                            </span>
                        </div>

                        <div className="flex justify-between text-sm pt-2 border-t border-gray-700/50">
                            <span className="text-gray-300 font-bold">{t.plansFinalTotal}</span>
                            <span className="text-white font-black">
                                ${((parseFloat(amount) || 0) * (1 + selectedPlan.roiUser/100)).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={handleConfirm}
                        disabled={!amount || parseFloat(amount) < selectedPlan.min || (selectedPlan.max && parseFloat(amount) > selectedPlan.max) || parseFloat(amount) > userBalance}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black py-4 rounded-xl shadow-lg border-b-4 border-green-800 active:border-b-0 active:mt-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Check size={20} /> {t.plansConfirmActivation}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
