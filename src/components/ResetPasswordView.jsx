import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const hasRecoveryInHash = () => {
  const h = String(window.location.hash || '').toLowerCase();
  return h.includes('type=recovery') || h.includes('recovery');
};

const getMode = () => {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('mode') || '').toLowerCase();
};

export function ResetPasswordView({ onDone, onGoToLogin }) {
  const [loading, setLoading] = useState(true);
  const [sessionEmail, setSessionEmail] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const isRecoveryIntent = useMemo(() => getMode() === 'recovery' || hasRecoveryInHash(), []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const email = data?.session?.user?.email ? String(data.session.user.email).toLowerCase() : null;
      setSessionEmail(email);
      setLoading(false);
      if (email && window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit = password.length >= 8 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!password || !confirm) {
      setErrorMsg('Preencha a nova senha e a confirmação.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Sua senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message || 'Não foi possível atualizar a senha.');
        return;
      }
      setSuccessMsg('Senha atualizada com sucesso.');
      setPassword('');
      setConfirm('');
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      onDone?.();
    } finally {
      setSubmitting(false);
    }
  };

  const showInvalid = !loading && (!isRecoveryIntent || !sessionEmail);

  return (
    <div className="min-h-[100dvh] w-full bg-black flex flex-col items-center justify-center p-4 relative overflow-x-hidden overflow-y-auto pt-[max(env(safe-area-inset-top),64px)] md:pt-32 pb-[env(safe-area-inset-bottom,20px)] md:bg-app-desktop bg-app-mobile bg-fixed selection:bg-yellow-500/30">
      <div className="absolute inset-0 bg-black/50 z-0 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-yellow-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md bg-gray-950/40 backdrop-blur-2xl border border-gray-800/50 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 animate-fade-in mt-16 md:mt-24 mb-16 md:mb-24 shrink-0">
        <div className="absolute -top-[10rem] md:-top-[12rem] left-1/2 transform -translate-x-1/2 w-full text-center">
          <img src="/logo/logoVdex.png" alt="VDexTrading" className="h-[12rem] md:h-[13.5rem] w-auto mx-auto select-none drop-shadow-[0_0_14px_rgba(234,179,8,0.4)] object-contain" />
        </div>

        <div className="text-center mb-6 pt-4">
          <p className="text-gray-300 text-sm font-semibold">Redefinir senha</p>
          <p className="text-gray-500 text-xs mt-1">
            {sessionEmail ? `Conta: ${sessionEmail}` : 'Abra o link do e-mail para continuar.'}
          </p>
        </div>

        {showInvalid ? (
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
              <ShieldCheck className="text-red-300" size={20} />
              <div className="flex-1">
                <p className="text-sm text-red-200 font-semibold">Link inválido ou expirado</p>
                <p className="text-xs text-red-200/70 mt-1">
                  Solicite um novo reset de senha pelo suporte ou na tela de login.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onGoToLogin?.()}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2.5 rounded-xl transition"
            >
              Voltar para login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-400 ml-1">Nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-10 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || submitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-500 hover:text-white"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading || submitting}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400 ml-1">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-10 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading || submitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-500 hover:text-white"
                  onClick={() => setShowConfirm((v) => !v)}
                  disabled={loading || submitting}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3">
                <p className="text-sm text-red-200">{errorMsg}</p>
              </div>
            )}
            {successMsg && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-3">
                <p className="text-sm text-green-200">{successMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || submitting || !canSubmit}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-400 text-black font-bold py-2.5 rounded-xl transition"
            >
              {submitting ? 'Atualizando...' : 'Salvar nova senha'}
            </button>

            <button
              type="button"
              onClick={() => onGoToLogin?.()}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2.5 rounded-xl transition"
              disabled={submitting}
            >
              Voltar para login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

