import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export function AuthView({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form States
  const [sponsor, setSponsor] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lang, setLang] = useState('pt');

  const normalizeId = (value) => String(value || '').trim().replace(/^@/, '').toLowerCase();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('sponsor') || '';
    const mode = params.get('mode') || '';
    const register = params.get('register') || '';

    const sponsorFromUrl = normalizeId(ref);
    if (sponsorFromUrl) setSponsor(sponsorFromUrl);

    if (mode.toLowerCase() === 'register' || register === '1' || sponsorFromUrl) {
      setIsLogin(false);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLogin) {
      if (!email || !password) {
        alert('Preencha todos os campos!');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error || !data?.user) {
        alert(error?.message || 'Credenciais inválidas!');
        return;
      }

      onLogin({
        email: data.user.email,
        name: data.user.user_metadata?.name || null,
        username: data.user.user_metadata?.username ? normalizeId(data.user.user_metadata.username) : null,
        sponsor: data.user.user_metadata?.sponsor ? normalizeId(data.user.user_metadata.sponsor) : null,
        lang: data.user.user_metadata?.lang || 'pt'
      });
    } else {
      // Cadastro
      if (!name || !username || !email || !password || !confirmPassword) {
        alert('Preencha todos os campos obrigatórios!');
        return;
      }
      
      if (password !== confirmPassword) {
        alert('As senhas não coincidem!');
        return;
      }

      const normalizedUsername = normalizeId(username);
      const normalizedSponsor = sponsor ? normalizeId(sponsor) : '';

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            name,
            username: normalizedUsername,
            sponsor: normalizedSponsor || 'vdex',
            lang
          }
        }
      });

      if (error || !data?.user) {
        alert(error?.message || 'Erro ao cadastrar.');
        return;
      }

      alert('Cadastro realizado com sucesso! Faça login.');
      setIsLogin(true);
    }
  };

  const handleForgotPassword = () => {
    alert('Função de recuperação simulada: Verifique seu e-mail (mock).');
  };

  return (
    <div className="min-h-[100dvh] w-full bg-black flex flex-col items-center justify-center p-4 relative overflow-x-hidden overflow-y-auto pt-[max(env(safe-area-inset-top),64px)] md:pt-32 pb-[env(safe-area-inset-bottom,20px)] md:bg-app-desktop bg-app-mobile bg-fixed selection:bg-yellow-500/30">
      {/* Background Effects / Overlay */}
      <div className="absolute inset-0 bg-black/50 z-0 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-yellow-600/10 rounded-full blur-[100px]"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md bg-gray-950/40 backdrop-blur-2xl border border-gray-800/50 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 animate-fade-in mt-16 md:mt-24 mb-16 md:mb-24 shrink-0">
        
        {/* Header Logo Outside Container to save space */}
        <div className="absolute -top-[10rem] md:-top-[12rem] left-1/2 transform -translate-x-1/2 w-full text-center">
          <img src="/logo/logoVdex.png" alt="VDexTrading" className="h-[12rem] md:h-[13.5rem] w-auto mx-auto select-none drop-shadow-[0_0_14px_rgba(234,179,8,0.4)] object-contain" />
        </div>

        <div className="text-center mb-6 pt-4">
          <h2 className="sr-only">VDexTrading</h2>
          <p className="text-gray-400 text-sm">
            {isLogin ? 'Acesse seu painel de controle' : 'Inicie sua jornada automatizada'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {!isLogin && (
            <>
              {/* Sponsor Field */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-3 flex items-center gap-3 mb-4">
                 <ShieldCheck className="text-blue-400" size={20} />
                 <div className="flex-1">
                    <label className="text-[10px] text-blue-300 uppercase font-bold block">Patrocinador</label>
                    <input 
                      type="text" 
                      placeholder="ID do Patrocinador"
                      className="bg-transparent text-white text-sm font-bold w-full focus:outline-none"
                      value={sponsor}
                      onChange={(e) => setSponsor(e.target.value)}
                    />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-500" size={18} />
                    <input 
                      type="text" 
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                      placeholder="Seu Nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 ml-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-500" size={18} />
                    <input 
                      type="text" 
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                      placeholder="@usuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-xs text-gray-400 ml-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type="email" 
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type={showPassword ? "text" : "password"}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-10 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                className="absolute right-3 top-3 text-gray-500 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs text-gray-400 ml-1">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-10 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button 
                  type="button"
                  className="absolute right-3 top-3 text-gray-500 hover:text-white"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {/* Lang Selector */}
          {!isLogin && (
             <div className="flex items-center gap-2 justify-end">
                <Globe size={14} className="text-gray-500" />
                <select 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value)}
                  className="bg-transparent text-gray-400 text-xs focus:outline-none cursor-pointer"
                >
                   <option value="pt">Português</option>
                   <option value="en">English</option>
                   <option value="es">Español</option>
                </select>
             </div>
          )}

          {isLogin && (
            <div className="flex justify-end">
              <button type="button" onClick={handleForgotPassword} className="text-xs text-blue-400 hover:text-blue-300">
                Esqueceu a senha?
              </button>
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-3 rounded-xl shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2"
          >
            {isLogin ? 'Entrar no Sistema' : 'Criar Minha Conta'} <ArrowRight size={18} />
          </button>

        </form>

        {/* Footer Toggle */}
        <div className="mt-6 text-center border-t border-gray-800 pt-4">
          <p className="text-sm text-gray-400">
            {isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-blue-400 hover:text-white font-bold transition"
            >
              {isLogin ? 'Cadastre-se' : 'Fazer Login'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
