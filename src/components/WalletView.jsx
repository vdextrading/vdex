import React, { useEffect, useState } from 'react';
import { X, Plus, Minus, ArrowRightLeft } from 'lucide-react';
import { CONFIG } from '../data/config';

export const WalletView = ({ t, user, formatCurrency, formatVDT, handleDepositAction, handleWithdrawAction, handleSwapAction, pendingNowPay, onResumeNowPay }) => {
  const [action, setAction] = useState(null); // 'deposit', 'withdraw', 'swap'

  // Deposit State
  const [depAsset, setDepAsset] = useState('usdt');
  const [depNet, setDepNet] = useState('');
  const [depAmount, setDepAmount] = useState('');

  // Withdraw State
  const [wdAsset, setWdAsset] = useState('usdt');
  const [wdAmount, setWdAmount] = useState('');
  const [wdAddress, setWdAddress] = useState('');

  // Swap State
  const [swapVdt, setSwapVdt] = useState('');
  const [swapDirection, setSwapDirection] = useState('vdtToUsd');

  useEffect(() => {
    if (action !== 'withdraw') return;
    if (String(wdAddress || '').trim()) return;
    const wallets = user?.wallets || {};
    const next = wdAsset === 'usdc' ? String(wallets.usdc_arbitrum || '') : String(wallets.usdt_bep20 || '');
    if (next) setWdAddress(next);
  }, [action, wdAsset, user?.wallets, wdAddress]);

  const networks = {
    usdt: ['TRC-20', 'BEP-20', 'ERC-20', 'SOL', 'POLYGON'],
    usdc: ['ERC-20', 'POLYGON', 'USDC']
  };

  const VdtTokenCard = () => (
    <div className="bg-gray-800 p-4 rounded-xl border border-yellow-400/30">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-yellow-400 font-bold text-lg">{t.vdtToken}</p>
          <p className="text-xs text-gray-400">{t.internalUtilityToken}</p>
        </div>
        <div className="text-right">
          <p className="text-white font-mono text-xl">{formatVDT(user.balances.vdt)}</p>
          <p className="text-xs text-gray-500">{t.vdtApproxLine}</p>
        </div>
      </div>
    </div>
  );

  const renderActionModal = () => {
    if (!action) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-700 p-6 animate-slideUp max-h-[80dvh] sm:max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white capitalize">{t[action]}</h3>
            <button onClick={() => setAction(null)} className="text-gray-400 hover:text-white"><X /></button>
          </div>

          {/* DEPOSIT FORM */}
          {action === 'deposit' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">{t.assetLabel}</label>
                <div className="flex gap-2">
                  <button onClick={() => { setDepAsset('usdt'); setDepNet(''); }} className={`flex-1 py-2 rounded-lg border ${depAsset === 'usdt' ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>USDT</button>
                  <button onClick={() => { setDepAsset('usdc'); setDepNet(''); }} className={`flex-1 py-2 rounded-lg border ${depAsset === 'usdc' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>USDC</button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">{t.selectNetwork}</label>
                <select 
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={depNet}
                  onChange={(e) => setDepNet(e.target.value)}
                >
                  <option value="">{t.selectPlaceholder}</option>
                  {networks[depAsset].map(net => <option key={net} value={net}>{net}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">{t.amount}</label>
                <input 
                  type="number" 
                  placeholder={t.minAmountPlaceholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none"
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                />
              </div>

              <button 
                onClick={() => {
                  if (!depNet) return;
                  handleDepositAction(depAsset, depNet, depAmount);
                  setAction(null);
                }}
                disabled={!depNet}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold py-3 rounded-lg mt-2"
              >
                {t.confirm}
              </button>
            </div>
          )}

          {/* WITHDRAW FORM */}
          {action === 'withdraw' && (
            <div className="space-y-4">
              <div>
                 <label className="text-xs text-gray-400 block mb-1">{t.assetLabel}</label>
                 <div className="flex gap-2">
                  <button onClick={() => setWdAsset('usdt')} className={`flex-1 py-2 rounded-lg border ${wdAsset === 'usdt' ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>USDT</button>
                  <button onClick={() => setWdAsset('usdc')} className={`flex-1 py-2 rounded-lg border ${wdAsset === 'usdc' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>USDC</button>
                 </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">{t.destinationAddress}</label>
                <input
                  type="text"
                  placeholder={t.pasteWalletHere}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                  value={wdAddress}
                  onChange={(e) => setWdAddress(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">{t.amount}</label>
                <input 
                  type="number" 
                  placeholder={t.minAmountPlaceholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                />
              </div>

              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 text-xs space-y-1">
                <p className="font-bold text-gray-300 mb-2 border-b border-gray-700 pb-1">{t.fees}</p>
                <div className="flex justify-between text-gray-400"><span>Taxa de saque</span><span>5%</span></div>
                <div className="flex justify-between text-white font-bold pt-2 border-t border-gray-700 mt-1">
                  <span>{t.feeEstimatedTotal}</span>
                  <span>~5%</span>
                </div>
              </div>

              <button 
                onClick={() => { handleWithdrawAction(wdAsset, wdAmount, wdAddress); setAction(null); }}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg"
              >
                {t.requestWithdraw}
              </button>
            </div>
          )}

          {/* SWAP FORM */}
          {action === 'swap' && (
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col items-center justify-center py-6">
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-1">{t.youSend}</p>
                  <input 
                    type="number" 
                    placeholder="0" 
                    className="bg-transparent text-center text-3xl font-bold text-white w-full focus:outline-none placeholder-gray-600"
                    value={swapVdt}
                    onChange={(e) => setSwapVdt(e.target.value)}
                  />
                  <span className="text-yellow-400 font-bold">
                    {swapDirection === 'vdtToUsd' ? 'VDT' : 'USD'}
                  </span>
                </div>
                
                <button 
                  type="button"
                  onClick={() => {
                    setSwapDirection(prev => prev === 'vdtToUsd' ? 'usdToVdt' : 'vdtToUsd');
                    setSwapVdt('');
                  }}
                  className="my-4 text-gray-500 hover:text-white bg-gray-900/60 border border-gray-700 rounded-full p-2 transition"
                >
                  <ArrowRightLeft className={swapDirection === 'vdtToUsd' ? 'rotate-90' : '-rotate-90'} />
                </button>

                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-1">{t.youReceive}</p>
                  <p className="text-3xl font-bold text-green-400">
                    {swapDirection === 'vdtToUsd'
                      ? `$${((Number(swapVdt) || 0) / 100).toFixed(2)}`
                      : `${((Number(swapVdt) || 0) * 100).toFixed(0)}`
                    }
                  </p>
                  <span className="text-green-600 font-bold">
                    {swapDirection === 'vdtToUsd' ? 'USD' : 'VDT'}
                  </span>
                </div>
              </div>

              <VdtTokenCard />

              <div className="text-center text-xs text-gray-500">
                {t.conversionRateLine}
              </div>

              <button 
                onClick={() => { handleSwapAction(swapVdt, swapDirection); setAction(null); }}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-lg"
              >
                {t.confirmSwap}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 space-y-6 animate-fadeIn pb-24 max-w-2xl mx-auto">
      {pendingNowPay?.order_id && (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-blue-300 font-bold">NOWPayments</p>
              <p className="text-white text-sm font-semibold break-words">
                Pedido pendente: {String(pendingNowPay.order_id).slice(0, 24)}{String(pendingNowPay.order_id).length > 24 ? '…' : ''}
              </p>
              <p className="text-[11px] text-blue-200/80 mt-1">
                {pendingNowPay.pay_amount ? `Enviar ${pendingNowPay.pay_amount} ${String(pendingNowPay.pay_currency || '').toUpperCase()}` : 'Retome o pagamento para ver o QR/endereço.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onResumeNowPay?.()}
              className="shrink-0 bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs"
            >
              {t?.depositSupportOpenFromNow || 'Abrir pagamento'}
            </button>
          </div>
        </div>
      )}
      {action && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-700 p-6 animate-slideUp max-h-[80dvh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white capitalize">{t[action]}</h3>
              <button onClick={() => setAction(null)} className="text-gray-400 hover:text-white"><X /></button>
            </div>

            {/* DEPOSIT FORM */}
            {action === 'deposit' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Asset</label>
                  <div className="flex gap-2">
                    <button onClick={() => { setDepAsset('usdt'); setDepNet(''); }} className={`flex-1 py-3 rounded-lg border text-sm font-bold ${depAsset === 'usdt' ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>USDT</button>
                    <button onClick={() => { setDepAsset('usdc'); setDepNet(''); }} className={`flex-1 py-3 rounded-lg border text-sm font-bold ${depAsset === 'usdc' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>USDC</button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t.selectNetwork}</label>
                  <select 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={depNet}
                    onChange={(e) => setDepNet(e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {networks[depAsset].map(net => <option key={net} value={net}>{net}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t.amount}</label>
                  <input 
                    type="number" 
                    placeholder={t.minAmountPlaceholder}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none"
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                  />
                </div>

                <button 
                  onClick={() => { 
                    if (!depNet) return;
                    handleDepositAction(depAsset, depNet, depAmount);
                    setAction(null);
                  }}
                  disabled={!depNet}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold py-3 rounded-lg mt-2 shadow-lg"
                >
                  {t.confirm}
                </button>
              </div>
            )}

            {/* WITHDRAW FORM */}
            {action === 'withdraw' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t.assetLabel}</label>
                   <div className="flex gap-2">
                    <button onClick={() => setWdAsset('usdt')} className={`flex-1 py-3 rounded-lg border text-sm font-bold ${wdAsset === 'usdt' ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>USDT</button>
                    <button onClick={() => setWdAsset('usdc')} className={`flex-1 py-3 rounded-lg border text-sm font-bold ${wdAsset === 'usdc' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>USDC</button>
                   </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t.destinationAddress}</label>
                  <input
                    type="text"
                    placeholder={t.pasteWalletHere}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                    value={wdAddress}
                    onChange={(e) => setWdAddress(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t.amount}</label>
                  <input 
                    type="number" 
                    placeholder={t.minAmountPlaceholder}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
                    value={wdAmount}
                    onChange={(e) => setWdAmount(e.target.value)}
                  />
                </div>

                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 text-xs space-y-1">
                  <p className="font-bold text-gray-300 mb-2 border-b border-gray-700 pb-1">{t.fees}</p>
                  <div className="flex justify-between text-gray-400"><span>Taxa de saque</span><span>5%</span></div>
                  <div className="flex justify-between text-white font-bold pt-2 border-t border-gray-700 mt-1">
                    <span>{t.feeEstimatedTotal}</span>
                    <span>~5%</span>
                  </div>
                </div>

                <button 
                  onClick={() => { handleWithdrawAction(wdAsset, wdAmount, wdAddress); setAction(null); }}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-lg"
                >
                  {t.requestWithdraw}
                </button>
              </div>
            )}

            {/* SWAP FORM */}
            {action === 'swap' && (
              <div className="space-y-4">
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col items-center justify-center py-6">
                  <div className="text-center w-full">
                    <p className="text-gray-400 text-sm mb-1">{t.youSend}</p>
                    <div className="flex items-center justify-center gap-2">
                        <input 
                        type="number" 
                        placeholder="0" 
                        className="bg-transparent text-right text-3xl font-bold text-white w-1/2 focus:outline-none placeholder-gray-600"
                        value={swapVdt}
                        onChange={(e) => setSwapVdt(e.target.value)}
                        />
                        <span className="text-yellow-400 font-bold text-xl w-1/2 text-left">
                        {swapDirection === 'vdtToUsd' ? 'VDT' : 'USD'}
                        </span>
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => {
                      setSwapDirection(prev => prev === 'vdtToUsd' ? 'usdToVdt' : 'vdtToUsd');
                      setSwapVdt('');
                    }}
                    className="my-4 text-gray-500 hover:text-white bg-gray-900/60 border border-gray-700 rounded-full p-2 transition hover:bg-gray-800"
                  >
                    <ArrowRightLeft className={swapDirection === 'vdtToUsd' ? 'rotate-90' : '-rotate-90'} />
                  </button>

                  <div className="text-center w-full">
                    <p className="text-gray-400 text-sm mb-1">{t.youReceive}</p>
                    <div className="flex items-center justify-center gap-2">
                        <p className="text-3xl font-bold text-green-400 w-1/2 text-right">
                        {swapDirection === 'vdtToUsd'
                            ? ((Number(swapVdt) || 0) / 100).toFixed(2)
                            : ((Number(swapVdt) || 0) * 100).toFixed(0)
                        }
                        </p>
                        <span className="text-green-600 font-bold text-xl w-1/2 text-left">
                        {swapDirection === 'vdtToUsd' ? 'USD' : 'VDT'}
                        </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-3 rounded-lg border border-yellow-400/30 flex justify-between items-center">
                   <div>
                     <p className="text-yellow-400 font-bold text-sm">Saldo VDT</p>
                     <p className="text-xs text-gray-400">Disponível para troca</p>
                   </div>
                   <p className="text-white font-mono font-bold">{formatVDT(user.balances.vdt)}</p>
                </div>

                <div className="text-center text-xs text-gray-500">
                  {t.conversionRateLine}
                </div>

                <button 
                  onClick={() => { handleSwapAction(swapVdt, swapDirection); setAction(null); }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg"
                >
                  {t.confirmSwap}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-700 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl"></div>
        <p className="text-gray-400 mb-1">{t.balance}</p>
        <div className="flex items-end gap-2 mb-6">
           <h2 className="text-3xl font-bold text-white">{formatCurrency(user.balances.usdt + user.balances.usdc)}</h2>
           {(user.balances.usdt > 0 || user.balances.usdc > 0) && <span className="text-xs text-gray-500 mb-2">(USD = USDT + USDC)</span>}
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => setAction('deposit')} 
            className="bg-blue-600/20 border border-blue-500/50 text-blue-400 py-2 rounded-lg text-sm hover:bg-blue-600 hover:text-white transition flex flex-col items-center gap-1"
          >
            <Plus size={16} /> {t.deposit}
          </button>
          <button 
            onClick={() => setAction('withdraw')}
            className="bg-gray-700/50 border border-gray-600 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-700 transition flex flex-col items-center gap-1"
          >
            <Minus size={16} /> {t.withdraw}
          </button>
          <button 
             onClick={() => setAction('swap')}
             className="bg-gray-700/50 border border-gray-600 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-700 transition flex flex-col items-center gap-1">
            <ArrowRightLeft size={16} /> {t.swap}
          </button>
        </div>
      </div>

      <VdtTokenCard />

      {/* Transaction History Mini */}
      <div>
         <h3 className="text-gray-400 text-sm mb-3 uppercase tracking-wider">{t.transactions}</h3>
         <div className="space-y-3">
            {user.history.slice(0, 5).map((tx, idx) => (
                <div key={idx} className="bg-gray-800/50 p-3 rounded-lg flex justify-between items-center border border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'deposit' || tx.type === 'swap' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {tx.type === 'deposit' || tx.type === 'swap' ? <Plus size={14} /> : <Minus size={14} />}
                    </div>
                    <div>
                      <p className="text-white text-sm capitalize">{tx.type}</p>
                      <p className="text-gray-500 text-[10px]">{tx.desc || tx.date}</p>
                    </div>
                  </div>
                  <span className={`font-mono ${tx.type === 'deposit' || tx.type === 'swap' ? 'text-green-400' : 'text-white'}`}>
                     {tx.type === 'deposit' || tx.type === 'swap' ? '+' : '-'}${tx.amount}
                  </span>
                </div>
            ))}
         </div>
      </div>
    </div>
  );
};
