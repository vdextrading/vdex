import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wallet, 
  Gamepad2, 
  Settings, 
  TrendingUp, 
  User, 
  Bell, 
  ArrowRightLeft, 
  ShieldCheck, 
  LogOut, 
  Zap, 
  ChevronRight, 
  Menu as MenuIcon, 
  Users, 
  FileText, 
  Activity, 
  Lock, 
  Camera, 
  Save, 
  CreditCard, 
  Plus, 
  Minus,
  Cpu,
  AlertTriangle,
  CheckCircle,
  X,
  Battery
} from 'lucide-react';

// Importações Refatoradas
import { CONFIG, NETWORK_PLAN, PLANS } from './data/config';
import { TRANSLATIONS } from './data/translations';
import { GameView } from './components/GameView';
import { PlansView } from './components/PlansView';
import { WalletView } from './components/WalletView';
import { TradingTerminal } from './components/TradingTerminal';
import { LandingPage } from './components/LandingPage';
import { AuthView } from './components/AuthView';
import { ResetPasswordView } from './components/ResetPasswordView';
import { DepositSupportModal } from './components/DepositSupportModal';
import { adminDeleteUser, adminSendPasswordReset, adminSetUserBlocked, adminUpdateUser, nowPaymentsCreatePayment, nowPaymentsHealth, nowPaymentsIpnSelftest, nowPaymentsMinAmount, nowPaymentsSyncMyOrder, nowPaymentsSyncPayment, upsertBotCycles } from './lib/supabaseEdge';
import { clearSupabaseAuthStorage, supabase } from './lib/supabaseClient';

// Estado padrão de segurança para evitar crashes com dados antigos/incompletos
const SAFE_USER_DEFAULTS = {
    balances: { usdt: 0, usdc: 0, vdt: 0 },
    activePlan: null,
    activePlans: [],
    botMode: 'trade',
    botArmedDayKey: null,
    botArmedAt: null,
    isBlocked: false,
    pinIsSet: false,
    history: [],
    notifications: [],
    wallets: {},
    gameCredits: { daily: 3 },
    quantumStats: { highScore: 0, totalSparks: 0 }
};

/**
 * COMPONENTE DASHBOARD (ANTIGO APP)
 * Agora recebe o usuário autenticado e a função de logout
 */
function Dashboard({ currentUser, onLogout }) {
  // --- ESTADO GERAL ---
  const [view, setView] = useState('home'); 
  const [lang, setLang] = useState(currentUser.lang || 'en');
  const [loading, setLoading] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [toast, setToast] = useState(null);
  const [externalLinkFallback, setExternalLinkFallback] = useState(null);
  const [walletGate, setWalletGate] = useState({ wallet_prelaunch_blocked: false, prelaunch_until: null, note: '' });
  const [walletGateLoading, setWalletGateLoading] = useState(false);
  const [nowPayOpen, setNowPayOpen] = useState(false);
  const [nowPayData, setNowPayData] = useState(null);
  const [pendingNowPays, setPendingNowPays] = useState([]);
  const [depositSupportOpen, setDepositSupportOpen] = useState(false);
  const [supportJumpTicketId, setSupportJumpTicketId] = useState(null);
  const [reportsTab, setReportsTab] = useState('all');
  const [teamStats, setTeamStats] = useState({ directs: 0, unilevel_total: 0, residual_total: 0, total_commissions: 0, recent: [], members: [] });
  const [qualifierStatus, setQualifierStatus] = useState(null);
  const [teamAuditOpen, setTeamAuditOpen] = useState(false);
  const [teamAuditMember, setTeamAuditMember] = useState('');
  const [teamAuditDay, setTeamAuditDay] = useState('');
  const [teamAuditLimit, setTeamAuditLimit] = useState(20);
  const [teamAuditLoading, setTeamAuditLoading] = useState(false);
  const [teamAuditError, setTeamAuditError] = useState(null);
  const [teamAuditResult, setTeamAuditResult] = useState(null);
  const [botsRange, setBotsRange] = useState('today');
  const [botsHistory, setBotsHistory] = useState([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsLoadError, setBotsLoadError] = useState(null);
  const [botsOffset, setBotsOffset] = useState(0);
  const [gameEvents, setGameEvents] = useState([]);
  const [terminalCreditPulse, setTerminalCreditPulse] = useState(0);
  const [terminalCreditMeta, setTerminalCreditMeta] = useState(null);
  const terminalCreditTotalRef = useRef(null);
  const botModeRef = useRef('trade');
  const terminalRef = useRef(null);
  const mainScrollRef = useRef(null);
  const adminTabPersistRef = useRef('usuarios');
  const legacyAdminEmailsRef = useRef(new Set([
    'vdexsupport@gmail.com',
    'colorartstudiobr@gmail.com',
    'samiroliver.oliver@gmail.com',
    'wilson270043@gmail.com',
    'redeempresariosdesucesso@gmail.com'
  ]));
  const contractsReconciledRef = useRef(false);
  const serverHydratedEmailRef = useRef(null);
  const ledgerLastSeenAtRef = useRef(null);
  const contractsLastInvestAtRef = useRef(null);
  const contractsRefreshInFlightRef = useRef(false);
  const [contractsRefreshTick, setContractsRefreshTick] = useState(0);
  const botPersistLastErrorRef = useRef({ msg: null, ts: 0 });
  const nowPayAutoSyncRef = useRef({ inFlight: false, lastOrderId: null, lastTs: 0 });
  const [adminCaps, setAdminCaps] = useState(() => {
    const email = String(currentUser?.email || '').toLowerCase();
    const isAdminLegacy = legacyAdminEmailsRef.current.has(email);
    return {
      isAdmin: isAdminLegacy,
      perms: isAdminLegacy ? { is_admin: true, is_superadmin: ['vdexsupport@gmail.com', 'colorartstudiobr@gmail.com'].includes(email), email } : null
    };
  });

  // --- DADOS DO USUÁRIO (Persistidos) ---
  // Merge inicial com defaults para garantir que campos como notifications existam
  const [user, setUser] = useState(() => {
     // Inicializa com segurança, garantindo que balances.vdt seja um número
     const initialUser = { ...SAFE_USER_DEFAULTS, ...currentUser };
     if (typeof initialUser.balances.vdt !== 'number' || isNaN(initialUser.balances.vdt)) {
         initialUser.balances.vdt = initialUser.balances.fdt || 0; // Tenta migrar FDT antigo ou zera
     }
     if (!Array.isArray(initialUser.activePlans)) initialUser.activePlans = [];
     if (initialUser.activePlan && initialUser.activePlans.length === 0) {
       initialUser.activePlans = [{
         id: `legacy_${initialUser.activePlan.startAt || Date.now()}`,
         planId: initialUser.activePlan.planId,
         amount: initialUser.activePlan.amount,
         startAt: initialUser.activePlan.startAt || Date.now(),
         accumulated: initialUser.activePlan.accumulated || 0,
         dailyState: initialUser.activePlan.dailyState || null,
         businessDaysCompleted: 0,
         lastPayoutDayCount: 0,
         lockedProfit: 0,
         withdrawableProfit: 0
       }];
     }
     initialUser.activePlan = null;
     return initialUser;
  });

  const t = { ...(TRANSLATIONS.en || {}), ...((TRANSLATIONS[lang] || {})) };

  const getNowPayStorageKey = () => {
    const email = String(user?.email || '').trim().toLowerCase();
    return email ? `vdex_nowpay_last_${email}` : null;
  };

  const sortNowPayItems = (items) => {
    const arr = Array.isArray(items) ? items.slice() : [];
    const toIso = (v) => {
      const s = String(v || '').trim();
      if (!s) return '';
      const d = new Date(s);
      return Number.isFinite(d.getTime()) ? d.toISOString() : s;
    };
    arr.sort((a, b) => {
      const au = toIso(a?.updated_at);
      const bu = toIso(b?.updated_at);
      if (au !== bu) return au < bu ? 1 : -1;
      const ac = toIso(a?.created_at);
      const bc = toIso(b?.created_at);
      if (ac !== bc) return ac < bc ? 1 : -1;
      const ao = String(a?.order_id || '');
      const bo = String(b?.order_id || '');
      return ao < bo ? 1 : (ao > bo ? -1 : 0);
    });
    return arr;
  };

  const loadPendingNowPays = () => {
    const key = getNowPayStorageKey();
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return [];
      const itemsRaw = Array.isArray(parsed.items) ? parsed.items : (Array.isArray(parsed) ? parsed : [parsed]);
      const items = itemsRaw
        .filter(Boolean)
        .filter((v) => String(v?.order_id || '').trim());
      return sortNowPayItems(items);
    } catch {
      return [];
    }
  };

  const savePendingNowPays = (items) => {
    const key = getNowPayStorageKey();
    if (!key) return;
    try {
      const arr = sortNowPayItems(Array.isArray(items) ? items : (items ? [items] : []));
      localStorage.setItem(key, JSON.stringify({ items: arr, saved_at: Date.now() }));
    } catch {}
  };

  const upsertPendingNowPay = (item) => {
    const row = item && typeof item === 'object' ? item : null;
    const orderId = String(row?.order_id || '').trim();
    if (!orderId) return;
    const current = Array.isArray(pendingNowPays) && pendingNowPays.length ? pendingNowPays : loadPendingNowPays();
    const next = sortNowPayItems([
      row,
      ...(Array.isArray(current) ? current : []).filter((v) => String(v?.order_id || '').trim() && String(v?.order_id || '').trim() !== orderId)
    ]);
    setPendingNowPays(next);
    savePendingNowPays(next);
  };

  const clearPendingNowPays = () => {
    const key = getNowPayStorageKey();
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {}
  };

  const loadPendingNowPaysFromServer = async ({ limit = 5 } = {}) => {
    try {
      const { data, error } = await supabase.rpc('nowpayments_my_pending_orders', { p_limit: Math.max(1, Math.min(20, Number(limit) || 5)) });
      if (error) return { ok: false, error: error.message };
      const items = Array.isArray(data?.items) ? data.items : [];
      const cleaned = items.filter((v) => String(v?.order_id || '').trim());
      return { ok: true, items: sortNowPayItems(cleaned) };
    } catch (e) {
      return { ok: false, error: e?.message || 'Falha ao carregar pendências' };
    }
  };

  const mapNowPayRowToModalData = (row) => {
    if (!row) return null;
    const orderId = String(row?.order_id || '').trim();
    if (!orderId) return null;
    const payCurrency = String(row?.pay_currency || '').trim();
    const depositAsset = String(row?.deposit_asset || '').trim();
    const priceCurrency = String(row?.price_currency || 'usd').trim();
    const priceAmount = Number(row?.price_amount) || 0;
    return {
      pay_currency: payCurrency ? payCurrency.toUpperCase() : '—',
      pay_amount: row?.pay_amount ?? null,
      pay_address: String(row?.pay_address || ''),
      invoice_url: String(row?.invoice_url || ''),
      order_id: orderId,
      payment_id: String(row?.payment_id || ''),
      price_amount: priceAmount > 0 ? priceAmount : null,
      requested_amount: priceAmount > 0 ? priceAmount : null,
      price_currency: priceCurrency ? priceCurrency.toUpperCase() : 'USD',
      deposit_asset: depositAsset ? depositAsset.toUpperCase() : 'USDT',
      payment_status: String(row?.payment_status || '')
    };
  };

  const resumePendingNowPay = (row) => {
    const base = row || pendingNowPays?.[0] || loadPendingNowPays()?.[0] || null;
    if (!base) return;
    const modal = mapNowPayRowToModalData(base) || base;
    setNowPayData(modal);
    setNowPayOpen(true);
  };

  const syncPendingNowPay = async (row) => {
    const orderId = String(row?.order_id || nowPayData?.order_id || '').trim();
    if (!orderId) return { ok: false, error: 'missing order_id' };

    const paymentId = String(row?.payment_id || nowPayData?.payment_id || '').trim() || null;
    const res = await nowPaymentsSyncMyOrder({ order_id: orderId, payment_id: paymentId });
    if (!res.ok) {
      triggerNotification('NOWPayments', res.error || 'Falha ao sincronizar pagamento', 'error');
      return res;
    }

    const after = await loadPendingNowPaysFromServer({ limit: 8 });
    if (after.ok) {
      const items = sortNowPayItems(Array.isArray(after.items) ? after.items : []);
      setPendingNowPays(items);
      if (items.length) savePendingNowPays(items);
      else clearPendingNowPays();

      if (nowPayOpen) {
        const modal = mapNowPayRowToModalData(items.find((v) => String(v?.order_id || '').trim() === String(nowPayData?.order_id || '').trim()) || null);
        if (modal) setNowPayData(modal);
      }
    }

    triggerNotification('NOWPayments', `Sincronizado. Status: ${String(res.data?.payment_status || '—')}`, 'success');
    return res;
  };

  const copyText = async (text, okMsg = 'Copiado.') => {
    const value = String(text || '');
    if (!value) return false;
    const legacyCopy = () => {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      el.setSelectionRange(0, el.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    };
    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        triggerNotification('NOWPayments', okMsg, 'success');
        return true;
      }
    } catch {}
    try {
      const ok = legacyCopy();
      if (ok) {
        triggerNotification('NOWPayments', okMsg, 'success');
        return true;
      }
    } catch {}
    triggerNotification('NOWPayments', 'Não foi possível copiar automaticamente.', 'error');
    return false;
  };

  const openExternalUrl = (url, { title = 'Link externo' } = {}) => {
    const href = String(url || '').trim();
    if (!href) return { ok: false, blocked: false };
    try {
      const w = window.open(href, '_blank', 'noopener,noreferrer');
      if (w) {
        try { w.opener = null; } catch {}
        return { ok: true, blocked: false };
      }
    } catch {}
    setExternalLinkFallback({ url: href, title: String(title || 'Link externo') });
    triggerNotification(String(title || 'Link externo'), 'Popup bloqueado pelo navegador. Clique para abrir manualmente.', 'error');
    return { ok: false, blocked: true };
  };

  useEffect(() => {
    botModeRef.current = user.botMode || 'trade';
  }, [user.botMode]);

  useEffect(() => {
    if (!user?.email) return;
    const loaded = loadPendingNowPays();
    setPendingNowPays(sortNowPayItems(loaded));
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    const run = async () => {
      const res = await loadPendingNowPaysFromServer({ limit: 8 });
      if (cancelled) return;
      if (res.ok) {
        const items = sortNowPayItems(res.items || []);
        setPendingNowPays(items);
        savePendingNowPays(items);
        return;
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    if (view !== 'wallet') return;
    let cancelled = false;
    const run = async () => {
      const res = await loadPendingNowPaysFromServer({ limit: 8 });
      if (cancelled) return;
      if (res.ok) {
        const items = sortNowPayItems(Array.isArray(res.items) ? res.items : []);
        setPendingNowPays(items);
        savePendingNowPays(items);

        const active = items?.[0] || null;
        if (nowPayOpen && active && String(nowPayData?.order_id || '') === String(active?.order_id || '')) {
          const modal = mapNowPayRowToModalData(active);
          if (modal) setNowPayData(modal);
        }

        const orderId = String(active?.order_id || '').trim();
        if (orderId) {
          const state = nowPayAutoSyncRef.current;
          const now = Date.now();
          const isSame = String(state.lastOrderId || '') === orderId;
          if (!state.inFlight && (!isSame || (now - Number(state.lastTs || 0)) >= 15000)) {
            state.inFlight = true;
            state.lastOrderId = orderId;
            state.lastTs = now;
            try {
              await nowPaymentsSyncMyOrder({ order_id: orderId, payment_id: active?.payment_id || null });
              const after = await loadPendingNowPaysFromServer({ limit: 8 });
              if (!cancelled) {
                if (after.ok) {
                  const nextItems = sortNowPayItems(Array.isArray(after.items) ? after.items : []);
                  setPendingNowPays(nextItems);
                  if (nextItems.length) savePendingNowPays(nextItems);
                  else clearPendingNowPays();

                  if (nowPayOpen) {
                    const modal = mapNowPayRowToModalData(nextItems.find((v) => String(v?.order_id || '') === String(nowPayData?.order_id || '')) || null);
                    if (modal) setNowPayData(modal);
                  }
                }
              }
            } catch {}
            state.inFlight = false;
          }
        }
      }
    };
    run();
    const interval = setInterval(run, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [view, user?.email]);

  useEffect(() => {
    const orderId = String(nowPayData?.order_id || '').trim();
    if (!nowPayOpen || !orderId) return;
    let cancelled = false;
    const run = async () => {
      const state = nowPayAutoSyncRef.current;
      const now = Date.now();
      const isSame = String(state.lastOrderId || '') === orderId;
      if (state.inFlight) return;
      if (isSame && (now - Number(state.lastTs || 0)) < 15000) return;
      state.inFlight = true;
      state.lastOrderId = orderId;
      state.lastTs = now;
      try {
        await nowPaymentsSyncMyOrder({ order_id: orderId, payment_id: nowPayData?.payment_id || null });
        const after = await loadPendingNowPaysFromServer({ limit: 8 });
        if (cancelled) return;
        if (after.ok) {
          const items = sortNowPayItems(Array.isArray(after.items) ? after.items : []);
          setPendingNowPays(items);
          if (items.length) savePendingNowPays(items);
          else clearPendingNowPays();

          const modal = mapNowPayRowToModalData(items.find((v) => String(v?.order_id || '').trim() === orderId) || null);
          if (modal && String(modal.order_id || '') === orderId) setNowPayData(modal);
        }
      } catch {}
      state.inFlight = false;
    };
    run();
    const interval = setInterval(run, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [nowPayOpen, nowPayData?.order_id]);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    const run = async () => {
      const { data, error } = await supabase.rpc('admin_my_permissions');
      if (cancelled) return;
      if (!error && data && typeof data === 'object') {
        setAdminCaps({ isAdmin: Boolean(data.is_admin), perms: data });
        return;
      }
      const email = String(user?.email || '').toLowerCase();
      const isAdminLegacy = legacyAdminEmailsRef.current.has(email);
      setAdminCaps({
        isAdmin: isAdminLegacy,
        perms: isAdminLegacy ? { is_admin: true, is_superadmin: ['vdexsupport@gmail.com', 'colorartstudiobr@gmail.com'].includes(email), email } : null
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    syncGameEnergy();
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    if (view !== 'game') return;
    let cancelled = false;
    const load = async () => {
      const res = await loadGameEvents();
      if (cancelled) return;
      if (!res.ok) return;
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [view, user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    if (view === 'admin') return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc('team_stats', { limit_recent: 5 });
      if (cancelled) return;
      if (error) return;
      if (!data || typeof data !== 'object') return;
      const directs = Number(data.directs) || 0;
      const unilevel_total = Number(data.unilevel_total) || 0;
      const residual_total = Number(data.residual_total) || 0;
      const total_commissions = Number(data.total_commissions) || 0;
      const recent = Array.isArray(data.recent) ? data.recent : [];
      const members = Array.isArray(data.members) ? data.members : [];
      setTeamStats({ directs, unilevel_total, residual_total, total_commissions, recent, members });
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.email, view, pendingNowPays]);

  useEffect(() => {
    if (!user?.email) return;
    if (view !== 'team') return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc('bonus_qualifier_status');
      if (cancelled) return;
      if (error) return;
      setQualifierStatus(data || null);
    };
    load();
    const interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.email, view]);

  // Main Background Ticker (Financial Logic) - NETWORK ONLY (disabled)
  useEffect(() => {
    return; 
  }, [user.activePlans?.length]);

  // --- FUNÇÕES AUXILIARES ---

  const makeId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const isAdmin = Boolean(adminCaps?.isAdmin);
  const adminPerms = adminCaps?.perms || {};
  const walletBlockedForCurrentUser = Boolean(walletGate?.wallet_prelaunch_blocked) && !isAdmin;

  const loadWalletGate = async () => {
    setWalletGateLoading(true);
    const { data, error } = await supabase.rpc('wallet_prelaunch_gate');
    if (!error && data && typeof data === 'object') {
      setWalletGate({
        wallet_prelaunch_blocked: Boolean(data.wallet_prelaunch_blocked),
        prelaunch_until: data.prelaunch_until || null,
        note: String(data.note || '')
      });
    }
    setWalletGateLoading(false);
  };

  useEffect(() => {
    if (!user?.email) return;
    loadWalletGate();
    const interval = setInterval(loadWalletGate, 15000);
    return () => clearInterval(interval);
  }, [user?.email]);

  useEffect(() => {
    if (!walletBlockedForCurrentUser) return;
    if (view !== 'wallet') return;
    setView('menu');
    triggerNotification('Wallet', `Wallet em MAINTENANCE${walletGate?.prelaunch_until ? ` até ${walletGate.prelaunch_until}` : ''}.`, 'error');
  }, [walletBlockedForCurrentUser, view, walletGate?.prelaunch_until]);

  const triggerNotification = (title, msg, type = 'info') => {
    const newNotif = { id: makeId(), title, msg, read: false, time: new Date().toLocaleTimeString(), type };
    setUser(prev => ({
      ...prev,
      notifications: [newNotif, ...prev.notifications]
    }));
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const mapBalancesFromServer = (row) => ({
    usdt: toNumber(row?.usdt_balance),
    usdc: toNumber(row?.usdc_balance),
    vdt: toNumber(row?.vdt_balance)
  });

  const applyWallet = async (entries) => {
    const { data, error } = await supabase.rpc('wallet_apply', { entries: entries || [] });
    if (error) return { ok: false, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, error: 'Resposta inválida do banco' };
    return { ok: true, balances: mapBalancesFromServer(row) };
  };

  const syncGameEnergy = async () => {
    const { data, error } = await supabase.rpc('game_energy_snapshot');
    if (error) {
      setUser(prev => ({ ...prev, gameCredits: { ...prev.gameCredits, daily: 0 } }));
      return { ok: false, error: error.message };
    }
    const energy = Number(data?.energy);
    if (!Number.isFinite(energy)) {
      setUser(prev => ({ ...prev, gameCredits: { ...prev.gameCredits, daily: 0 } }));
      return { ok: false, error: 'Energia inválida' };
    }
    setUser(prev => ({ ...prev, gameCredits: { ...prev.gameCredits, daily: energy } }));
    return { ok: true, energy };
  };

  const handleConsumeEnergy = async (game) => {
    const g = String(game || 'game');
    const { data, error } = await supabase.rpc('game_energy_consume', { p_amount: 1, p_game: g });
    if (error) {
      const msg = String(error.message || '');
      const pretty =
        msg.toLowerCase().includes('insufficient energy') ? 'Energia insuficiente.' :
        (msg || 'Falha ao consumir energia.');
      triggerNotification('Energy', pretty, 'error');
      return false;
    }
    const energy = Number(data?.energy);
    if (Number.isFinite(energy)) {
      setUser(prev => ({ ...prev, gameCredits: { ...prev.gameCredits, daily: energy } }));
    }
    try {
      await supabase.rpc('game_event_add', { p_game: g, p_energy_spent: 1, p_sparks: 0, p_vdt_amount: 0, p_meta: { event: 'start' } });
    } catch {}
    return true;
  };

  const loadGameEvents = async () => {
    const { data, error } = await supabase.rpc('game_events_list', { p_limit: 20 });
    if (error) return { ok: false, error: error.message };
    const rows = Array.isArray(data) ? data : [];
    setGameEvents(rows);
    return { ok: true, rows };
  };

  const mapLedgerRowToHistory = (row) => {
    const kind = String(row?.kind || '').toLowerCase();
    const asset = String(row?.asset || '').toLowerCase();
    const amountRaw = toNumber(row?.amount);
    const amount = Math.abs(amountRaw);
    const createdAtMs = row?.created_at ? new Date(row.created_at).getTime() : Date.now();
    const timeString = new Date(createdAtMs).toLocaleTimeString();
    const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};

    if (kind === 'deposit') {
      const net = meta?.network ? ` (${String(meta.network)})` : '';
      return { id: row.id, type: 'deposit', amount, date: timeString, desc: `${asset.toUpperCase()}${net}`, ts: createdAtMs };
    }
    if (kind === 'withdraw') {
      const status = meta?.status ? String(meta.status) : '';
      const suffix = status ? ` ${status}` : '';
      return { id: row.id, type: 'withdraw', amount, date: timeString, desc: `${asset.toUpperCase()}${suffix}`, ts: createdAtMs };
    }
    if (kind === 'withdraw_refund') {
      return { id: row.id, type: 'deposit', amount, date: timeString, desc: `${asset.toUpperCase()} Refund`, ts: createdAtMs };
    }
    if (kind === 'invest') {
      const planName = meta?.plan_name ? String(meta.plan_name) : 'Plano';
      return { id: row.id, type: 'plan_activation', amount, date: timeString, desc: planName, ts: createdAtMs };
    }
    if (kind === 'unilevel' || kind === 'residual') {
      return { id: row.id, type: kind, amount, date: timeString, desc: asset.toUpperCase(), ts: createdAtMs };
    }
    if (kind === 'swap' && amountRaw > 0) {
      const direction = meta?.direction ? String(meta.direction) : '';
      if (asset === 'vdt') return { id: row.id, type: 'swap', amount, date: timeString, desc: `USD -> ${amount.toFixed(0)} VDT`, ts: createdAtMs };
      return { id: row.id, type: 'swap', amount, date: timeString, desc: `${direction === 'vdtToUsd' ? 'VDT -> USD' : 'Swap'} ${asset.toUpperCase()}`, ts: createdAtMs };
    }
    if (kind === 'energy_buy' || kind === 'credits_buy') {
      const energy = toNumber(meta?.energy) || toNumber(meta?.credits) || 0;
      const suffix = energy > 0 ? `+${energy} ENERGY` : 'ENERGY';
      return { id: row.id, type: 'energy_buy', amount, date: timeString, desc: suffix, ts: createdAtMs };
    }
    if (kind === 'vault' || kind === 'game' || kind === 'runner' || kind === 'quantum') {
      if (amount <= 0.00009) return null;
      const type = amountRaw > 0 ? 'game_win' : 'game_loss';
      const baseDesc =
        kind === 'vault' ? 'Vault' :
        (kind === 'runner' || (kind === 'quantum' && String(meta?.game || '').toLowerCase() === 'runner')) ? 'Runner' :
        (kind === 'quantum' ? 'Quantum' : 'Game');
      const cap = (() => {
        if (!meta?.cap_applied) return '';
        const scope = String(meta?.cap_scope || '').toLowerCase();
        if (scope === 'day') return ` (cap ${toNumber(meta?.cap_max_vdt) || 5} VDT/dia)`;
        return ` (cap ${toNumber(meta?.cap_round_max_vdt) || toNumber(meta?.cap_max_vdt) || 5} VDT/rodada)`;
      })();
      return { id: row.id, type, amount, date: timeString, desc: `${baseDesc}${cap}`, ts: createdAtMs };
    }
    return null;
  };

  useEffect(() => {
    if (!user?.email) return;
    if (view === 'admin') return;
    let cancelled = false;

    const loadLedger = async () => {
      const { data, error } = await supabase
        .from('wallet_ledger')
        .select('id, kind, asset, amount, meta, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) return;

      const rows = Array.isArray(data) ? data : [];
      const ledgerHistory = rows
        .map(mapLedgerRowToHistory)
        .filter(Boolean);

      const newestCreatedAt = rows?.[0]?.created_at ? new Date(rows[0].created_at).toISOString() : null;
      const lastSeenAt = ledgerLastSeenAtRef.current;

      const newestInvestCreatedAt = (() => {
        for (const r of rows) {
          if (String(r?.kind || '').toLowerCase() !== 'invest') continue;
          if (!r?.created_at) continue;
          return new Date(r.created_at).toISOString();
        }
        return null;
      })();
      if (newestInvestCreatedAt) {
        const prev = contractsLastInvestAtRef.current;
        if (!prev || newestInvestCreatedAt > prev) {
          contractsLastInvestAtRef.current = newestInvestCreatedAt;
          setContractsRefreshTick((t) => t + 1);
        }
      }

      if (lastSeenAt && newestCreatedAt) {
        let matchedPending = false;
        const pendingIds = new Set(
          (Array.isArray(pendingNowPays) ? pendingNowPays : [])
            .map((v) => String(v?.order_id || '').trim())
            .filter(Boolean)
        );
        const matched = new Set();
        for (const r of rows) {
          if (!r?.created_at) continue;
          if (new Date(r.created_at).toISOString() <= lastSeenAt) break;
          if (String(r.kind || '').toLowerCase() !== 'deposit') continue;
          const a = String(r.asset || '').toUpperCase();
          const n = toNumber(r.amount);
          if (n <= 0) continue;
          const meta = r?.meta && typeof r.meta === 'object' ? r.meta : {};
          const creditedOrderId = String(meta?.nowpayments_order_id || '').trim();
          if (creditedOrderId && pendingIds.has(creditedOrderId)) {
            matchedPending = true;
            matched.add(creditedOrderId);
          }
          triggerNotification('Depósito', `Depósito de ${formatCurrency(n)} ${a} recebido!`, 'success');
        }
        if (matchedPending) {
          const next = (Array.isArray(pendingNowPays) ? pendingNowPays : []).filter((v) => !matched.has(String(v?.order_id || '').trim()));
          setPendingNowPays(sortNowPayItems(next));
          if (next.length) savePendingNowPays(next);
          else clearPendingNowPays();
        }
      }

      if (!lastSeenAt && newestCreatedAt) {
        ledgerLastSeenAtRef.current = newestCreatedAt;
      } else if (newestCreatedAt) {
        ledgerLastSeenAtRef.current = newestCreatedAt;
      }

      setUser(prev => {
        const keepLocal = (prev.history || []).filter(h => {
          const type = String(h?.type || '');
          return type.startsWith('bot_') || type.startsWith('hft_');
        });
        const merged = [...keepLocal, ...ledgerHistory];
        const seen = new Set();
        const deduped = merged.filter(item => {
          const key = item?.id ? String(item.id) : `${item.type}_${item.date}_${item.desc}_${item.amount}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const sorted = deduped.slice().sort((a, b) => (Number(b?.ts) || 0) - (Number(a?.ts) || 0));
        return { ...prev, history: sorted };
      });
    };

    loadLedger();
    const interval = setInterval(loadLedger, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.email, view]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatVDT = (val) => {
    const num = Number(val);
    if (isNaN(num)) return '0 VDT';
    return `${Math.floor(num).toLocaleString()} VDT`;
  };

  const getDayKey = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const isBusinessDay = (d) => {
    const day = d.getDay();
    return day >= 1 && day <= 5;
  };

  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const randN = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const generateDailyPnls = (target, minutes) => {
    const mean = target / minutes;
    const std = Math.abs(mean) * 2.2;
    const minPnl = -Math.abs(mean) * 6;
    const maxPnl = Math.abs(mean) * 10;

    for (let attempt = 0; attempt < 30; attempt++) {
      let values = Array.from({ length: minutes }, () => {
        const v = mean + randN() * std;
        return Math.max(minPnl, Math.min(maxPnl, v));
      });

      let sum = values.reduce((a, b) => a + b, 0);
      const diff = target - sum;
      const adj = diff / minutes;
      values = values.map(v => v + adj);
      sum = values.reduce((a, b) => a + b, 0);
      values[values.length - 1] += (target - sum);

      const negs = values.filter(v => v < 0).length;
      if (negs >= Math.floor(minutes * 0.18) && Number.isFinite(values[0])) return values;
    }

    const values = Array.from({ length: minutes }, () => mean);
    values[values.length - 1] += (target - values.reduce((a, b) => a + b, 0));
    return values;
  };

  const generateCyclePnls = (target, cycles) => {
    const mean = target / cycles;
    const std = Math.abs(mean) * 2.6;
    const minPnl = -Math.abs(mean) * 4.5;
    const maxPnl = Math.abs(mean) * 7.5;

    for (let attempt = 0; attempt < 30; attempt++) {
      let values = Array.from({ length: cycles }, () => {
        const v = mean + randN() * std;
        return Math.max(minPnl, Math.min(maxPnl, v));
      });

      let sum = values.reduce((a, b) => a + b, 0);
      const diff = target - sum;
      const adj = diff / cycles;
      values = values.map(v => v + adj);
      sum = values.reduce((a, b) => a + b, 0);
      values[values.length - 1] += (target - sum);

      const negs = values.filter(v => v < 0).length;
      if (negs >= Math.max(1, Math.floor(cycles * 0.2)) && Number.isFinite(values[0])) return values;
    }

    const values = Array.from({ length: cycles }, () => mean);
    values[values.length - 1] += (target - values.reduce((a, b) => a + b, 0));
    return values;
  };

  const buildDailyCycleSequence = ({ dailyTargetPct, dailyTargetProfit, principal }) => {
    const roundsPlanned =
      dailyTargetPct >= 3 ? 4 :
      dailyTargetPct >= 2 ? 3 :
      2;

    const roundPcts =
      roundsPlanned === 4 ? [1, 1, 1, Math.max(0.01, dailyTargetPct - 3)] :
      roundsPlanned === 3 ? [1, 1, Math.max(0.01, dailyTargetPct - 2)] :
      [Math.max(0.01, dailyTargetPct)];

    const seq = [];
    for (let roundIndex = 0; roundIndex < roundPcts.length; roundIndex++) {
      const isLastRound = roundIndex === roundPcts.length - 1;
      const isSmallLastRound = isLastRound && roundPcts[roundIndex] < 1;
      const cyclesInRound = isSmallLastRound ? randomInt(2, 3) : randomInt(4, 6);
      const roundProfit = principal * (roundPcts[roundIndex] / 100);
      const pnls = generateCyclePnls(roundProfit, cyclesInRound);
      for (let i = 0; i < pnls.length; i++) {
        seq.push({ mode: 'trade', targetProfit: pnls[i], roundIndex });
      }
      if (roundIndex < roundPcts.length - 1) {
        const pauseCycles = randomInt(1, 3);
        for (let j = 0; j < pauseCycles; j++) {
          seq.push({ mode: 'analysis', targetProfit: 0, roundIndex });
        }
      }
    }

    const sum = seq.reduce((acc, item) => acc + (item.mode === 'trade' ? item.targetProfit : 0), 0);
    const diff = dailyTargetProfit - sum;
    for (let i = seq.length - 1; i >= 0; i--) {
      if (seq[i].mode === 'trade') {
        seq[i] = { ...seq[i], targetProfit: seq[i].targetProfit + diff };
        break;
      }
    }

    return { roundsPlanned, sequence: seq };
  };

  const planMetaById = (planId) => PLANS.find(p => p.id === planId) || null;

  const contractFromDb = (c) => ({
    id: c.id,
    planId: c.plan_id,
    amount: toNumber(c.amount),
    startAt: c.start_at ? new Date(c.start_at).getTime() : (c.created_at ? new Date(c.created_at).getTime() : Date.now()),
    accumulated: toNumber(c.accumulated),
    businessDaysCompleted: Number(c.business_days_completed) || 0,
    lastPayoutDayCount: Number(c.last_payout_day_count) || 0,
    lockedProfit: toNumber(c.locked_profit),
    withdrawableProfit: toNumber(c.withdrawable_profit),
    dailyProfitTargeted: toNumber(c.daily_profit_targeted),
    dailyProfitApplied: toNumber(c.daily_profit_applied),
    supabaseContractId: c.id,
    planDurationDays: Number(c.plan_duration_days) || planMetaById(c.plan_id)?.duration || 0,
    planRoiTotal: toNumber(c.plan_roi_total) || planMetaById(c.plan_id)?.roiTotal || 0,
    withdrawEveryDays: Number(c.withdraw_every_days) || planMetaById(c.plan_id)?.withdrawEveryDays || 1,
    dailyState: c.daily_day_key ? {
      dayKey: c.daily_day_key,
      status: c.daily_state_status || 'pending',
      cycleSeconds: 600,
      dailyTargetPct: toNumber(c.daily_target_pct),
      dailyTargetProfit: toNumber(c.daily_target_profit),
      roundsPlanned: Number(c.daily_rounds_planned) || 0,
      cycleIndex: Number(c.daily_cycle_index) || 0,
      profitToday: toNumber(c.daily_profit_today),
      sequence: Array.isArray(c.daily_sequence) ? c.daily_sequence : [],
      cycleStartedAt: c.current_cycle_started_at ? new Date(c.current_cycle_started_at).getTime() : null,
      lastCycleFinishedAt: c.last_cycle_finished_at ? new Date(c.last_cycle_finished_at).getTime() : null
    } : null
  });

  const serializeRuntimeContract = (contract) => ({
    contract_id: contract.supabaseContractId || contract.id,
    daily_day_key: contract.dailyState?.dayKey || null,
    daily_state_status: contract.dailyState?.status || null,
    daily_cycle_index: Number(contract.dailyState?.cycleIndex) || 0,
    daily_profit_today: toNumber(contract.dailyState?.profitToday),
    daily_profit_targeted: toNumber(contract.dailyState?.dailyTargetProfit),
    daily_profit_applied: toNumber(contract.dailyState?.profitToday),
    daily_sequence: Array.isArray(contract.dailyState?.sequence) ? contract.dailyState.sequence : [],
    daily_rounds_planned: Number(contract.dailyState?.roundsPlanned) || 0,
    daily_target_pct: toNumber(contract.dailyState?.dailyTargetPct),
    daily_target_profit: toNumber(contract.dailyState?.dailyTargetProfit),
    bot_mode: contract.dailyState?.status === 'running'
      ? (contract.dailyState.sequence?.[contract.dailyState.cycleIndex]?.mode || contract.botMode || 'trade')
      : (contract.dailyState?.status === 'pending' ? 'analysis' : (contract.botMode || 'trade')),
    current_cycle_started_at: contract.dailyState?.cycleStartedAt
      ? new Date(contract.dailyState.cycleStartedAt).toISOString()
      : null,
    last_cycle_finished_at: contract.dailyState?.lastCycleFinishedAt
      ? new Date(contract.dailyState.lastCycleFinishedAt).toISOString()
      : null,
    business_days_completed: Number(contract.businessDaysCompleted) || 0,
    last_payout_day_count: Number(contract.lastPayoutDayCount) || 0,
    locked_profit: toNumber(contract.lockedProfit),
    withdrawable_profit: toNumber(contract.withdrawableProfit),
    accumulated: toNumber(contract.accumulated)
  });

  const [serverDay, setServerDay] = useState(null);
  const serverNowMsRef = useRef(null);

  useEffect(() => {
    if (serverDay?.now_ts) {
      const ms = new Date(serverDay.now_ts).getTime();
      if (Number.isFinite(ms)) serverNowMsRef.current = ms;
    }
  }, [serverDay?.now_ts]);

  useEffect(() => {
    if (view === 'admin') return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc('bot_day_status');
      if (cancelled) return;
      if (error) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.day_key) return;
      setServerDay(row);
    };
    if (user?.email) load();
    const interval = setInterval(() => {
      if (user?.email) load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.email, view]);

  const getNow = () => new Date(serverNowMsRef.current ?? Date.now());

  const getNyDayKey = () => {
    return getNow().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  };

  const isNyBusinessDay = () => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(getNow());
    return wd !== 'Sat' && wd !== 'Sun';
  };

  const getBotDaySnapshot = () => {
    return {
      dayKey: getNyDayKey(),
      isBusinessDay: isNyBusinessDay(),
      armedToday: Boolean(serverDay?.armed_today),
      nowMs: serverNowMsRef.current ?? Date.now(),
      botArmedDayKey: serverDay?.bot_armed_day_key || user.botArmedDayKey || null,
      botArmedAt: serverDay?.bot_armed_at || user.botArmedAt || null
    };
  };

  const persistRuntimeToDb = async (contracts, nextUserPatch = null) => {
    if (!user?.email) return { ok: false };
    const payload = (contracts || [])
      .filter(c => c?.supabaseContractId)
      .map(serializeRuntimeContract);
    if (payload.length) {
      const { error } = await supabase.rpc('contracts_save_runtime_many', { contracts: payload });
      if (error) return { ok: false, error: error.message || 'Falha ao persistir runtime do BOT' };
    }

    if (nextUserPatch?.botArmedDayKey || nextUserPatch?.botArmedAt) {
      setUser(prev => ({ ...prev, ...nextUserPatch }));
    }
    return { ok: true };
  };

  const notifyBotPersistError = (message) => {
    const now = Date.now();
    const last = botPersistLastErrorRef.current;
    if (last?.msg === message && now - (last?.ts || 0) < 60_000) return;
    botPersistLastErrorRef.current = { msg: message, ts: now };
    triggerNotification('BOT', message, 'error');
  };

  const persistBotCycles = async (cycles) => {
    if (!Array.isArray(cycles) || !cycles.length) return;
    const { error } = await supabase.rpc('bot_cycles_upsert', { cycles });
    if (!error) return;

    const edgeRes = await upsertBotCycles({ user, cycles }).catch(() => null);
    if (edgeRes?.ok) return;
    notifyBotPersistError(edgeRes?.error || error.message || 'Falha ao gravar ciclos do BOT no banco');
  };

  const loadAdminUsers = async (search = '') => {
    const { data, error } = await supabase.rpc('admin_users_list', {
      search_text: String(search || '').trim() || null,
      max_rows: 40
    });
    if (error) return { ok: false, error: error.message || 'Falha ao carregar usuários' };
    return { ok: true, items: Array.isArray(data?.items) ? data.items : [] };
  };

  const loadAdminUserDetail = async (userId) => {
    if (!userId || (typeof userId === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))) {
      return { ok: false, error: 'ID de usuário inválido' };
    }
    const { data, error } = await supabase.rpc('admin_user_detail', {
      target_user_id: userId
    });
    if (error) return { ok: false, error: error.message || 'Falha ao carregar detalhes do usuário' };
    return { ok: true, detail: data || null };
  };

  useEffect(() => {
    const email = String(user?.email || '').toLowerCase();
    if (!email) return;
    if (serverHydratedEmailRef.current === email) return;
    serverHydratedEmailRef.current = email;

    const run = async () => {
      const botDay = getBotDaySnapshot();
      const balancesRes = await supabase.rpc('wallet_get_balances');
      if (!balancesRes.error) {
        const row = Array.isArray(balancesRes.data) ? balancesRes.data[0] : balancesRes.data;
        if (row) {
          const nextBalances = mapBalancesFromServer(row);
          setUser(prev => ({ ...prev, balances: { ...prev.balances, ...nextBalances } }));
        }
      }

      const profileRpc = await supabase.rpc('my_profile');
      if (!profileRpc.error) {
        const row = Array.isArray(profileRpc.data) ? profileRpc.data[0] : profileRpc.data;
        if (row) {
          if (row.is_blocked) {
            triggerNotification('Conta', 'Seu acesso foi bloqueado pelo administrador.', 'error');
            await supabase.auth.signOut().catch(() => {});
            clearSupabaseAuthStorage();
            setUser(prev => ({ ...prev, isBlocked: true }));
            onLogout?.();
            return;
          }
          const nextName = row.name ? String(row.name) : null;
          const nextUsername = row.username ? String(row.username).trim().replace(/^@/, '').toLowerCase() : null;
          const nextSponsor = row.sponsor_code ? String(row.sponsor_code).trim().replace(/^@/, '').toLowerCase() : null;
          const nextSponsorUsername = row.sponsor_username ? String(row.sponsor_username).trim().replace(/^@/, '').toLowerCase() : null;
          setUser(prev => ({
            ...prev,
            name: nextName || prev.name,
            username: nextUsername || prev.username,
            sponsor_code: nextSponsor || prev.sponsor_code,
            sponsor_username: nextSponsorUsername || prev.sponsor_username,
            isBlocked: Boolean(row.is_blocked)
          }));
        }
      }

      const pinRes = await supabase.rpc('wallet_pin_is_set');
      if (!pinRes.error) {
        const val = Array.isArray(pinRes.data) ? pinRes.data[0] : pinRes.data;
        setUser(prev => ({ ...prev, pinIsSet: Boolean(val) }));
      }

      const walletsRes = await supabase.rpc('wallet_get_withdraw_wallets');
      if (!walletsRes.error) {
        const wallets = walletsRes.data?.wallets && typeof walletsRes.data.wallets === 'object' ? walletsRes.data.wallets : null;
        if (wallets) setUser(prev => ({ ...prev, wallets: { ...wallets } }));
      }

      await Promise.resolve(supabase.rpc('contracts_sync_from_ledger', { max_rows: 200 })).catch(() => null);
      const { data: remoteContracts, error: remoteContractsError } = await supabase
        .from('plan_contracts')
        .select('*')
        .order('created_at', { ascending: false });
      if (!remoteContractsError) {
        const mapped = (Array.isArray(remoteContracts) ? remoteContracts : []).map(contractFromDb);
        setUser(prev => ({
          ...prev,
          activePlans: mapped,
          botArmedDayKey: botDay.botArmedDayKey || prev.botArmedDayKey,
          botArmedAt: botDay.botArmedAt || prev.botArmedAt
        }));
      }
    };

    run();
  }, [user?.email, serverDay?.bot_armed_day_key, serverDay?.bot_armed_at]);

  const [dayTick, setDayTick] = useState(() => Date.now());

  useEffect(() => {
    if (!user.activePlans?.length) return;
    const interval = setInterval(() => setDayTick(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [user.activePlans?.length]);

  useEffect(() => {
    if (!user.activePlans?.length) return;

    if (!serverDay?.day_key) return;
  }, [
    user.activePlans,
    dayTick,
    serverDay?.day_key,
    serverDay?.is_business_day,
    serverDay?.armed_today,
    serverDay?.bot_armed_day_key,
    serverDay?.bot_armed_at
  ]);

  const handleHftSync = (profit, opsCount, breakdown = []) => {
     if (profit === 0 && opsCount === 0 && (!Array.isArray(breakdown) || breakdown.length === 0)) return;

     const now = getNow();
     const botDay = getBotDaySnapshot();
     const timeString = now.toLocaleTimeString();

     let completedDailyTargets = 0;
     const totalFromBreakdown = Array.isArray(breakdown) && breakdown.length
       ? breakdown.reduce((acc, b) => acc + (Number(b.profit) || 0), 0)
       : Number(profit) || 0;

     const cyclesForSupabase = (() => {
       const byLocalId = new Map((user.activePlans || []).map(c => [c.id, c]));
       const finishedAt = new Date().toISOString();
       const out = [];
       (Array.isArray(breakdown) ? breakdown : []).forEach(b => {
         const localId = b.contractId;
         const contract = byLocalId.get(localId);
         const ds = contract?.dailyState;
         const contractId = contract?.supabaseContractId;
         if (!contractId || !ds || ds.status !== 'running') return;
         const item = ds.sequence?.[ds.cycleIndex];
         const mode = item?.mode || 'trade';
         out.push({
           contract_id: contractId,
           day_key: ds.dayKey,
           cycle_index: ds.cycleIndex,
           mode,
           target_profit: Number(item?.targetProfit) || 0,
           applied_profit: Number(b.profit) || 0,
           ops_count: mode === 'trade' ? Number(opsCount) || 0 : 0,
           started_at: ds.cycleStartedAt ? new Date(ds.cycleStartedAt).toISOString() : finishedAt,
           finished_at: finishedAt
         });
       });
       return out;
     })();

     let nextUserSnapshot = null;
     setUser(prev => {
         // Evitar duplicidade de registros no mesmo segundo (React StrictMode ou Timer Glitch)
         const lastEntry = prev.history[0];
         if (lastEntry && 
             lastEntry.type === 'hft_profit' && 
             lastEntry.date === timeString &&
             lastEntry.amount === totalFromBreakdown.toFixed(4)) {
             return prev;
         }

         const byContract = new Map();
         if (Array.isArray(breakdown) && breakdown.length) {
           breakdown.forEach(b => byContract.set(b.contractId, Number(b.profit) || 0));
         }

         const nextActivePlans = (prev.activePlans || []).map(contract => {
           const ds = contract.dailyState;
           if (!ds || ds.status !== 'running' || ds.dayKey !== botDay.dayKey) return contract;

           const currentItem = ds.sequence?.[ds.cycleIndex];
           if (!currentItem) return { ...contract, dailyState: { ...ds, status: 'done' } };

           const appliedProfit = byContract.has(contract.id) ? byContract.get(contract.id) : 0;
           const nextIndex = (ds.cycleIndex || 0) + 1;
           const nextProfitToday = (ds.profitToday || 0) + appliedProfit;
           const reachedEnd = nextIndex >= (ds.sequence?.length || 0);

           if (reachedEnd) {
             completedDailyTargets += 1;
             const nextBusinessDaysCompleted = (contract.businessDaysCompleted || 0) + 1;
             const planMeta = PLANS.find(p => p.id === contract.planId);
             const withdrawEvery = planMeta?.withdrawEveryDays || 1;
             const lockedProfit = (contract.lockedProfit || 0) + ds.dailyTargetProfit;
             let withdrawableProfit = contract.withdrawableProfit || 0;
             let lastPayoutDayCount = contract.lastPayoutDayCount || 0;
             let nextLocked = lockedProfit;

             if ((nextBusinessDaysCompleted - lastPayoutDayCount) >= withdrawEvery) {
               withdrawableProfit += nextLocked;
               nextLocked = 0;
               lastPayoutDayCount = nextBusinessDaysCompleted;
             }

             const diffToTarget = ds.dailyTargetProfit - nextProfitToday;
             return {
               ...contract,
               accumulated: (contract.accumulated || 0) + appliedProfit + diffToTarget,
               businessDaysCompleted: nextBusinessDaysCompleted,
               lastPayoutDayCount,
               lockedProfit: nextLocked,
               withdrawableProfit,
                botMode: 'analysis',
               dailyState: {
                 ...ds,
                 status: 'done',
                 cycleIndex: nextIndex,
                  profitToday: ds.dailyTargetProfit,
                  cycleStartedAt: null,
                  lastCycleFinishedAt: now.getTime()
               }
             };
           }

           const nextMode = ds.sequence?.[nextIndex]?.mode || 'trade';
           return {
             ...contract,
             accumulated: (contract.accumulated || 0) + appliedProfit,
             botMode: nextMode,
             dailyState: {
               ...ds,
               cycleIndex: nextIndex,
               profitToday: nextProfitToday,
               status: 'running',
               cycleStartedAt: now.getTime(),
               lastCycleFinishedAt: now.getTime()
             }
           };
         });

        if (totalFromBreakdown === 0 && opsCount === 0) {
          const nextMode = 'analysis';
          const shouldLogPause = prev.botMode !== nextMode;
          nextUserSnapshot = {
            ...prev,
            botMode: nextMode,
            activePlans: nextActivePlans,
            history: shouldLogPause
              ? [
                  {
                    id: makeId(),
                    type: 'bot_pause',
                    amount: '0.0000',
                    date: timeString,
                    desc: 'Analisando próxima entrada (10min)'
                  },
                  ...prev.history
                ]
              : prev.history
          };
          return nextUserSnapshot;
        }

        const nextMode = 'trade';
        const shouldLogResume = prev.botMode !== nextMode;

        nextUserSnapshot = {
            ...prev,
            botMode: nextMode,
            activePlans: nextActivePlans,
            history: [
                ...(shouldLogResume ? [{
                    id: makeId(),
                    type: 'bot_resume',
                    amount: '0.0000',
                    date: timeString,
                    desc: 'Retomando operações'
                }] : []),
                { 
                    id: makeId(),
                    type: 'hft_profit', 
                    amount: totalFromBreakdown.toFixed(4), 
                    date: timeString, 
                    desc: `Ciclo 10min (${opsCount} ops)` 
                }, 
                ...prev.history
            ]
         };
        return nextUserSnapshot;
     });

     if (cyclesForSupabase.length) {
       persistBotCycles(cyclesForSupabase).catch(() => {});
     }

     if (nextUserSnapshot?.activePlans?.length) {
       persistRuntimeToDb(nextUserSnapshot.activePlans, {
         botArmedDayKey: user.botArmedDayKey,
         botArmedAt: user.botArmedAt
        }).then((res) => {
          if (res && res.ok === false && res.error) notifyBotPersistError(res.error);
        }).catch(() => {});
     }

     if (totalFromBreakdown === 0 && opsCount === 0) {
       if (botModeRef.current !== 'analysis') {
         triggerNotification('BOT', 'Analisando a melhor entrada (10min).', 'info');
       }
       return;
     }

     if (botModeRef.current === 'analysis') {
       triggerNotification('BOT', 'Retomando operações.', 'info');
     }

     const sign = totalFromBreakdown >= 0 ? '+' : '';
     triggerNotification(
         'HFT Report', 
         `Ciclo finalizado: ${opsCount} operações. Lucro: ${sign}$${totalFromBreakdown.toFixed(4)}`,
         totalFromBreakdown >= 0 ? 'success' : 'error'
     );

     if (completedDailyTargets > 0) {
       triggerNotification(
         'Meta Diária',
         `Meta diária atingida. Robô pausado até o próximo dia útil.`,
         'success'
       );
     }
  };

  // --- AÇÕES DO USUÁRIO ---

  const handleActivatePlan = async (plan, customAmount) => {
    const amount = customAmount || plan.min;
    
    const usdBalance = (Number(user.balances.usdt) || 0) + (Number(user.balances.usdc) || 0);
    if (usdBalance < amount) {
      triggerNotification('Erro', 'Saldo USD insuficiente (USDT + USDC).', 'error');
      return;
    }

    const usdtAvail = Number(user.balances.usdt) || 0;
    const toPayUsdt = Math.min(usdtAvail, Number(amount) || 0);
    const toPayUsdc = Math.max(0, (Number(amount) || 0) - toPayUsdt);
    const activationId = makeId();
    const entries = [
      ...(toPayUsdt > 0
        ? [{
            kind: 'invest',
            asset: 'usdt',
            amount: -toPayUsdt,
            meta: { plan_id: plan.id, plan_name: plan.name, activation_id: activationId }
          }]
        : []),
      ...(toPayUsdc > 0
        ? [{
            kind: 'invest',
            asset: 'usdc',
            amount: -toPayUsdc,
            meta: { plan_id: plan.id, plan_name: plan.name, activation_id: activationId }
          }]
        : [])
    ];

    const pay = await applyWallet(entries);
    if (!pay.ok) {
      triggerNotification('Erro', pay.error || 'Falha ao debitar saldo no banco', 'error');
      return;
    }

    const contractId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setUser(prev => ({
        ...prev,
        balances: { ...prev.balances, ...pay.balances },
        activePlans: [
          {
            id: contractId,
            planId: plan.id,
            amount: amount,
            startAt: Date.now(),
            accumulated: 0,
            dailyState: null,
            businessDaysCompleted: 0,
            lastPayoutDayCount: 0,
            lockedProfit: 0,
            withdrawableProfit: 0,
            planDurationDays: plan.duration,
            planRoiTotal: plan.roiTotal,
            withdrawEveryDays: plan.withdrawEveryDays,
            supabaseContractId: null
          },
          ...(prev.activePlans || [])
        ],
        history: [{ type: 'plan_activation', amount: amount, date: new Date().toLocaleTimeString(), desc: plan.name }, ...prev.history]
    }));
    triggerNotification('Sucesso', `${plan.name} ativado com $${amount}!`, 'success');
    setView('home');

    try {
      const { data, error } = await supabase.rpc('contracts_sync_from_ledger', { max_rows: 50 });
      if (error) throw error;
      const items = Array.isArray(data?.items) ? data.items : [];
      const created = items.find(i => String(i?.activation_id || '') === activationId) || null;
      const supabaseId = created?.contract_id || null;
      if (!supabaseId) {
        triggerNotification('Plano', t.contractSyncPending, 'error');
        return;
      }
      setUser(prev => ({
        ...prev,
        activePlans: (prev.activePlans || []).map(c => c.id === contractId ? { ...c, supabaseContractId: supabaseId } : c)
      }));
      triggerNotification('Plano', 'Contrato sincronizado no banco.', 'success');
    } catch (e) {
      triggerNotification('Plano', e?.message || 'Falha ao sincronizar contrato no banco', 'error');
    }
  };

  const handleGamePlay = async () => {
    if (user.balances.vdt < CONFIG.gameCost) {
      triggerNotification('Game', 'VDT Insuficiente.', 'error');
      return;
    }

    const win = Math.random() > 0.5;
    const reward = win ? CONFIG.gameCost * 2 : 0;
    const delta = -CONFIG.gameCost + reward;
    const before = user.balances.vdt;

    const res = await applyWallet([{
      kind: 'game',
      asset: 'vdt',
      amount: delta,
      meta: { win, cost: CONFIG.gameCost, reward }
    }]);
    if (!res.ok) {
      triggerNotification('Erro', res.error || 'Falha ao registrar jogo', 'error');
      return;
    }

    setUser(prev => ({
      ...prev,
      balances: { ...prev.balances, ...res.balances }
    }));

    if (win) {
      const applied = toNumber(res.balances.vdt) - toNumber(before);
      if (applied <= 0.00009) {
        triggerNotification('Game', 'Limite por rodada (5 VDT) atingido.', 'info');
      } else if (applied + 0.00009 < toNumber(delta)) {
        triggerNotification('Game', `Limite por rodada aplicado: +${applied.toFixed(4)} VDT`, 'info');
      } else {
        triggerNotification('Game', `${t.win} ${CONFIG.gameCost * 2} VDT!`, 'success');
      }
    }
    else triggerNotification('Game', t.lose, 'error');
  };

  const handleVaultResult = async (win, amount) => {
    const reward = win ? Math.max(0, Number(amount) || 0) : 0;
    const before = user.balances.vdt;
    let applied = 0;
    if (reward > 0.00009) {
      const res = await applyWallet([{
        kind: 'vault',
        asset: 'vdt',
        amount: reward,
        meta: { win: true, reward }
      }]);
      if (!res.ok) {
        triggerNotification('Erro', res.error || 'Falha ao registrar resultado do vault', 'error');
        await supabase.rpc('game_event_add', { p_game: 'vault', p_energy_spent: 0, p_sparks: 0, p_vdt_amount: 0, p_meta: { win: true, reward, error: res.error || null } });
        loadGameEvents();
        return;
      }
      applied = toNumber(res.balances.vdt) - toNumber(before);
      setUser(prev => ({ ...prev, balances: { ...prev.balances, ...res.balances } }));
    }

    await supabase.rpc('game_event_add', { p_game: 'vault', p_energy_spent: 0, p_sparks: 0, p_vdt_amount: applied, p_meta: { win: !!win, reward, applied_vdt: applied } });
    loadGameEvents();

    if (win) {
      if (applied + 0.00009 < reward) triggerNotification('Vault Hacker', `Limite por rodada aplicado: +${applied.toFixed(4)} VDT`, 'info');
      else triggerNotification('Vault Hacker', `SYSTEM HACKED! +${applied.toFixed(4)} VDT`, 'success');
    } else {
      triggerNotification('Vault Hacker', 'ACCESS DENIED! +0 VDT', 'error');
    }
  };

  const handleQuantumGameOver = async (gameKey, score, sparks) => {
    const gk = String(gameKey || 'quantum').toLowerCase();
    const title = gk === 'runner' ? (t?.gameRunnerName || 'Platform Runner') : (t?.gameQuantumName || 'Quantum Dash');
    const payoutKind = gk === 'runner' ? 'runner' : 'quantum';
    const sparksPerVDT = Math.max(1, Number(CONFIG.quantumSparksPerVDT) || 50);
    const rawGain = Math.max(0, toNumber(sparks)) / sparksPerVDT;
    const gain = Math.round(rawGain * 10000) / 10000;
    const before = user.balances.vdt;
    let applied = 0;

    if (gain > 0.00009) {
      const res = await applyWallet([{
        kind: payoutKind,
        asset: 'vdt',
        amount: gain,
        meta: { game: gk, score: toNumber(score), sparks: toNumber(sparks), sparks_per_vdt: sparksPerVDT }
      }]);
      if (res.ok) {
        applied = toNumber(res.balances.vdt) - toNumber(before);
        setUser(prev => ({ ...prev, balances: { ...prev.balances, ...res.balances } }));
        if (applied + 0.00009 < gain) triggerNotification(title, `Limite por rodada aplicado: +${applied.toFixed(4)} VDT`, 'info');
        else triggerNotification(title, `+${applied.toFixed(4)} VDT`, 'success');
      } else {
        triggerNotification(title, res.error || 'Falha ao registrar resultado', 'error');
      }
    }

    setUser(prev => {
      const newHighScore = Math.max(prev.quantumStats?.highScore || 0, score);
      const newTotalSparks = (prev.quantumStats?.totalSparks || 0) + sparks;
      return {
        ...prev,
        quantumStats: { highScore: newHighScore, totalSparks: newTotalSparks }
      };
    });
    
    if (sparks > 0) triggerNotification(title, `Coletou ${sparks} Sparks!`, 'success');

    await supabase.rpc('game_event_add', { p_game: gk, p_energy_spent: 0, p_sparks: toNumber(sparks), p_vdt_amount: applied, p_meta: { score: toNumber(score), sparks_per_vdt: sparksPerVDT, requested_vdt: gain, applied_vdt: applied } });
    loadGameEvents();
  };

  const handleBuyEnergy = async (amount) => {
    const pack = Math.max(1, Number(amount) || 1);
    const unit = Number(CONFIG.energyUnitPriceVDT) || 5;
    const beforeEnergy = Number(user.gameCredits?.daily) || 0;
    const beforeVdt = toNumber(user.balances.vdt);

    const tryBuy = await supabase.rpc('game_energy_buy', { p_amount: pack });
    const { data, error } = tryBuy?.error ? await supabase.rpc('game_energy_refill') : tryBuy;
    if (error) {
      triggerNotification(t.errorLabel || 'Erro', error.message || 'Falha ao processar recarga', 'error');
      return { ok: false, error: error.message || 'Falha ao processar recarga' };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      triggerNotification(t.errorLabel || 'Erro', 'Resposta inválida do banco', 'error');
      return { ok: false, error: 'Resposta inválida do banco' };
    }
    const energy = Number(row.energy);
    const serverBalances = mapBalancesFromServer(row);
    const afterVdt = toNumber(serverBalances.vdt);
    const costActual = Math.max(0, beforeVdt - afterVdt);
    const deltaEnergy = Number.isFinite(energy) ? Math.max(0, energy - beforeEnergy) : null;
    setUser(prev => ({
      ...prev,
      balances: { ...prev.balances, ...serverBalances },
      gameCredits: { ...prev.gameCredits, daily: Number.isFinite(energy) ? energy : (CONFIG.gameEnergyMax || 3) }
    }));
    const msg =
      lang === 'pt'
        ? `Comprado +${deltaEnergy ?? pack} ENERGY por ${costActual.toFixed(2)} VDT.`
        : lang === 'es'
          ? `Compraste +${deltaEnergy ?? pack} ENERGY por ${costActual.toFixed(2)} VDT.`
          : `Purchased +${deltaEnergy ?? pack} ENERGY for ${costActual.toFixed(2)} VDT.`;
    triggerNotification(t.financials || 'Shop', msg, 'success');
    loadGameEvents();
    return { ok: true, energy: Number.isFinite(energy) ? energy : null };
  };

  const handleBuyCredits = async () => {
    const pack = Number(CONFIG.energyRefillPack) || 3;
    await handleBuyEnergy(pack);
  };

  const handleSaveSettings = async (formData) => {
    const nextWallets = formData?.wallets && typeof formData.wallets === 'object'
      ? formData.wallets
      : null;
    const nextPinRaw = String(formData?.financialPassword || '').trim();
    if (nextPinRaw) {
      if (!/^[0-9]{6}$/.test(nextPinRaw)) {
        triggerNotification('Configurações', 'A senha financeira deve ter exatamente 6 números.', 'error');
        return { ok: false };
      }
      const pinRes = await supabase.rpc('wallet_set_pin', { p_pin: nextPinRaw });
      if (pinRes.error) {
        triggerNotification('Configurações', pinRes.error.message || 'Falha ao salvar senha financeira.', 'error');
        return { ok: false };
      }
    }
    let persistedWallets = null;
    if (nextWallets) {
      const walletsRes = await supabase.rpc('wallet_set_withdraw_wallets', { p_wallets: nextWallets });
      if (walletsRes.error) {
        triggerNotification('Configurações', walletsRes.error.message || 'Falha ao salvar carteiras.', 'error');
        return { ok: false };
      }
      persistedWallets = walletsRes.data?.wallets && typeof walletsRes.data.wallets === 'object' ? walletsRes.data.wallets : null;
    }
    setUser(prev => ({
      ...prev,
      wallets: persistedWallets ?? nextWallets ?? prev.wallets,
      pinIsSet: prev.pinIsSet || Boolean(nextPinRaw),
      photoUrl: formData.photoUrl || prev.photoUrl
    }));
    triggerNotification('Configurações', 'Dados atualizados com sucesso!', 'success');
    return { ok: true };
  };

  // --- FUNÇÕES DA CARTEIRA ---
  const handleDepositAction = async (asset, network, amount) => {
    if (walletBlockedForCurrentUser) {
      triggerNotification('Wallet', `Wallet em MAINTENANCE${walletGate?.prelaunch_until ? ` até ${walletGate.prelaunch_until}` : ''}.`, 'error');
      return { ok: false };
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount < CONFIG.minTransaction) {
      triggerNotification('Erro', `Depósito mínimo de $${CONFIG.minTransaction}`, 'error');
      return { ok: false };
    }
    const assetLower = String(asset || '').toLowerCase();
    const netUpper = String(network || '').toUpperCase();
    let payCurrency = (() => {
      if (assetLower === 'usdt') {
        if (netUpper.includes('TRC')) return 'usdttrc20';
        if (netUpper.includes('BEP') || netUpper.includes('BSC')) return 'usdtbsc';
        if (netUpper.includes('ERC') || netUpper.includes('ETH')) return 'usdterc20';
        if (netUpper.includes('SOL')) return 'usdtsol';
        if (netUpper.includes('POLYGON') || netUpper.includes('MATIC')) return 'usdtmatic';
        return '';
      }
      if (assetLower === 'usdc') {
        if (netUpper.includes('POLYGON') || netUpper.includes('MATIC')) return 'usdcmatic';
        if (netUpper.includes('ERC') || netUpper.includes('ETH')) return 'usdcerc20';
        return 'usdc';
      }
      return '';
    })();
    if (!payCurrency) {
      triggerNotification('Erro', 'Rede não suportada para pagamento no momento. Use TRC-20 ou BEP-20.', 'error');
      return { ok: false };
    }
    let adjustedAmount = numAmount;
    const requestedAmount = numAmount;
    const systemMin = Number(CONFIG.minTransaction) || 10;
    const maxAutoExtra = 2;
    const maxTarget = Math.ceil((systemMin + maxAutoExtra) * 100) / 100;
    const candidateByAsset = {
      usdt: ['usdttrc20', 'usdtbsc', 'usdtmatic', 'usdtsol', 'usdterc20'],
      usdc: ['usdc', 'usdcmatic', 'usdcerc20']
    };
    const getMinFiat = async (currency) => {
      const res = await nowPaymentsMinAmount({ pay_currency: currency, fiat_equivalent: 'usd' });
      if (!res.ok) return Number.NaN;
      const minFiat = Number(res.data?.data?.fiat_equivalent);
      return Number.isFinite(minFiat) ? minFiat : Number.NaN;
    };
    let selectedMinFiat = await getMinFiat(payCurrency);
    if (Number.isFinite(selectedMinFiat) && selectedMinFiat > maxTarget + 0.00009) {
      const candidates = candidateByAsset[assetLower] || [payCurrency];
      let bestCurrency = payCurrency;
      let bestMin = selectedMinFiat;
      for (const candidate of candidates) {
        const min = await getMinFiat(candidate);
        if (!Number.isFinite(min)) continue;
        if (min < bestMin) {
          bestMin = min;
          bestCurrency = candidate;
        }
      }
      if (bestCurrency !== payCurrency && bestMin <= maxTarget + 0.00009) {
        triggerNotification(
          'NOWPayments',
          `Rede ${payCurrency.toUpperCase()} exige mínimo $${selectedMinFiat.toFixed(2)}. Ajustamos para ${bestCurrency.toUpperCase()} para manter o mínimo do sistema.`,
          'info'
        );
        payCurrency = bestCurrency;
        selectedMinFiat = bestMin;
      } else {
        triggerNotification(
          'NOWPayments',
          `No momento, as redes de ${assetLower.toUpperCase()} estão com mínimo acima de $${maxTarget.toFixed(2)} (menor atual: $${bestMin.toFixed(2)}).`,
          'error'
        );
        return { ok: false };
      }
    }

    if (Number.isFinite(selectedMinFiat)) {
      const required = Math.max(systemMin, selectedMinFiat);
      if (required > adjustedAmount + 0.00009) {
        const requiredRounded = Math.ceil(required * 100) / 100;
        const delta = requiredRounded - adjustedAmount;
        if (delta <= 2.00009) {
          adjustedAmount = requiredRounded;
          triggerNotification('NOWPayments', `Mínimo para ${payCurrency.toUpperCase()} hoje é $${adjustedAmount.toFixed(2)}. Ajuste automático (máx +$2,00).`, 'info');
        } else {
          triggerNotification('NOWPayments', `Mínimo para ${payCurrency.toUpperCase()} hoje é $${requiredRounded.toFixed(2)}. Para manter o mínimo do sistema ($${systemMin.toFixed(2)}), use outra rede/moeda ou aumente o valor.`, 'error');
          return { ok: false };
        }
      }
    }

    const makePayment = async (amountUsd) => {
      return nowPaymentsCreatePayment({
        price_amount: amountUsd,
        pay_currency: payCurrency,
        deposit_asset: assetLower,
        price_currency: 'usd',
        order_description: `Maintenance VDexTrading (${String(network || '').trim() || 'app'})`
      });
    };

    let nowRes = await makePayment(adjustedAmount);
    if (!nowRes.ok) {
      const msg = String(nowRes.error || '').toLowerCase();
      const isMinError = msg.includes('less than minimal') || msg.includes('is less than minimal') || msg.includes('minimal');
      if (isMinError) {
        const maxExtra = 2;
        const base = Math.max(systemMin, adjustedAmount);
        for (const bump of [0.25, 0.5, 1, 2]) {
          const next = Math.ceil((base + bump) * 100) / 100;
          if (next - numAmount > maxExtra + 0.00009) continue;
          const retry = await makePayment(next);
          if (retry.ok) {
            adjustedAmount = next;
            nowRes = retry;
            triggerNotification('NOWPayments', `Ajuste automático (máx +$2,00) aplicado: $${adjustedAmount.toFixed(2)}.`, 'info');
            break;
          }
        }
      }
    }
    if (!nowRes.ok) {
      triggerNotification('Erro', nowRes.error || 'Falha ao criar pagamento na NOWPayments', 'error');
      return { ok: false };
    }
    const order = nowRes.data?.order || {};
    const payAmount = Number(order?.pay_amount) || 0;
    const address = String(order?.pay_address || '');
    const invoiceUrl = String(order?.invoice_url || '');
    const msg = payAmount > 0
      ? `Pagamento criado: envie ${payAmount} ${String(order?.pay_currency || payCurrency).toUpperCase()}.`
      : `Pagamento criado em ${String(order?.pay_currency || payCurrency).toUpperCase()}.`;
    triggerNotification('NOWPayments', msg, 'success');
    if (address) {
      triggerNotification('NOWPayments', `Endereço: ${address.slice(0, 14)}...`, 'info');
    }
    const nextNowPayData = {
      pay_currency: String(order?.pay_currency || payCurrency || '').toUpperCase(),
      pay_amount: payAmount,
      pay_address: address,
      invoice_url: invoiceUrl,
      order_id: String(order?.order_id || ''),
      payment_id: String(order?.payment_id || ''),
      price_amount: Number(order?.price_amount) || adjustedAmount,
      requested_amount: requestedAmount,
      price_currency: String(order?.price_currency || 'usd').toUpperCase(),
      deposit_asset: String(order?.deposit_asset || assetLower || '').toUpperCase()
    };
    setNowPayData(nextNowPayData);
    upsertPendingNowPay(nextNowPayData);
    setNowPayOpen(true);
    return { ok: true };
  };

  const handleWithdrawAction = async (asset, amount, address, pin) => {
    if (walletBlockedForCurrentUser) {
      triggerNotification('Wallet', `Wallet em MAINTENANCE${walletGate?.prelaunch_until ? ` até ${walletGate.prelaunch_until}` : ''}.`, 'error');
      return;
    }
    if (!user?.pinIsSet) {
      triggerNotification('Erro', 'Cadastre sua senha financeira (6 números) em Configurações antes de sacar.', 'error');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount < CONFIG.minTransaction) {
      triggerNotification('Erro', `Saque mínimo de $${CONFIG.minTransaction}`, 'error');
      return;
    }
    if (numAmount > 10000) {
      triggerNotification('Erro', `Saque máximo diário é de $10000`, 'error');
      return;
    }
    if (user.balances[asset] < numAmount) {
      triggerNotification('Erro', `Saldo insuficiente.`, 'error');
      return;
    }

    const destinationAddress = String(address || '').trim() || null;
    const pinStr = String(pin || '').trim();
    if (!/^[0-9]{6}$/.test(pinStr)) {
      triggerNotification('Erro', 'Informe sua senha financeira de 6 números.', 'error');
      return;
    }
    const feeRate = 0.05;
    const feeAmount = Math.round((numAmount * feeRate) * 10000) / 10000;
    const netAmount = Math.round((numAmount - feeAmount) * 10000) / 10000;
    if (netAmount <= 0) {
      triggerNotification('Erro', 'Valor líquido inválido para saque.', 'error');
      return;
    }
    const { data, error } = await supabase.rpc('wallet_withdraw_request', {
      p_asset: asset,
      p_amount: numAmount,
      p_address: destinationAddress,
      p_pin: pinStr
    });
    if (error) {
      triggerNotification('Erro', error.message || 'Falha ao registrar saque', 'error');
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const serverBalances = row ? mapBalancesFromServer(row) : null;
    if (!serverBalances) {
      triggerNotification('Erro', 'Resposta inválida do servidor ao registrar saque', 'error');
      return;
    }

    setUser(prev => ({
      ...prev,
      balances: { ...prev.balances, ...serverBalances },
      history: [{ type: 'withdraw', amount: numAmount, date: new Date().toLocaleTimeString(), desc: `${asset.toUpperCase()} Pending (fee 5%)` }, ...prev.history]
    }));
    triggerNotification('Sucesso', `Solicitação de saque enviada! Taxa 5%: ${formatCurrency(feeAmount)}. Você recebe: ${formatCurrency(netAmount)}.`, 'success');
  };

  const handleSwapAction = async (amount, direction = 'vdtToUsd') => {
    if (walletBlockedForCurrentUser) {
      triggerNotification('Wallet', `Wallet em MAINTENANCE${walletGate?.prelaunch_until ? ` até ${walletGate.prelaunch_until}` : ''}.`, 'error');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;
    
    const rate = CONFIG.vdtRate;

    if (direction === 'vdtToUsd') {
      if (user.balances.vdt < numAmount) {
        triggerNotification('Erro', 'Saldo VDT insuficiente.', 'error');
        return;
      }

      const usdAmount = numAmount / rate;

      const res = await applyWallet([
        { kind: 'swap', asset: 'vdt', amount: -numAmount, meta: { direction: 'vdtToUsd', rate } },
        { kind: 'swap', asset: 'usdt', amount: usdAmount, meta: { direction: 'vdtToUsd', rate } }
      ]);
      if (!res.ok) {
        triggerNotification('Erro', res.error || 'Falha ao registrar troca', 'error');
        return;
      }

      setUser(prev => ({
        ...prev,
        balances: { ...prev.balances, ...res.balances },
        history: [{ type: 'swap', amount: usdAmount, date: new Date().toLocaleTimeString(), desc: `${numAmount} VDT -> USD` }, ...prev.history]
      }));
      triggerNotification('Sucesso', `Troca realizada: +$${usdAmount.toFixed(2)}`, 'success');
      return;
    }

    if (user.balances.usdt < numAmount) {
      triggerNotification('Erro', 'Saldo USDT insuficiente.', 'error');
      return;
    }

    const vdtAmount = numAmount * rate;

    const res = await applyWallet([
      { kind: 'swap', asset: 'usdt', amount: -numAmount, meta: { direction: 'usdToVdt', rate } },
      { kind: 'swap', asset: 'vdt', amount: vdtAmount, meta: { direction: 'usdToVdt', rate } }
    ]);
    if (!res.ok) {
      triggerNotification('Erro', res.error || 'Falha ao registrar troca', 'error');
      return;
    }

    setUser(prev => ({
      ...prev,
      balances: { ...prev.balances, ...res.balances },
      history: [{ type: 'swap', amount: vdtAmount, date: new Date().toLocaleTimeString(), desc: `$${numAmount.toFixed(2)} USD -> ${vdtAmount} VDT` }, ...prev.history]
    }));
    triggerNotification('Sucesso', `Troca realizada: +${vdtAmount} VDT`, 'success');
  };


  // --- SUB-COMPONENTES (Renderização) ---

  const Header = () => (
    <div className="flex justify-between items-center p-4 bg-gray-950/40 backdrop-blur-md border-b border-gray-800/50 shrink-0 z-50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-500 to-green-400 flex items-center justify-center shadow-[0_0_10px_rgba(234,179,8,0.5)] overflow-hidden">
          {user.photoUrl ? (
            <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User size={16} className="text-white" />
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400">{t.welcome}</p>
          <p className="text-sm font-bold text-white">{user.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => {
           const next = lang === 'pt' ? 'en' : lang === 'en' ? 'es' : 'pt';
           setLang(next);
        }} className="text-xs text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 transition">
          {lang.toUpperCase()}
        </button>
        <div className="relative" onClick={() => setShowNotif(!showNotif)}>
          <Bell size={20} className="text-gray-300 hover:text-yellow-400 cursor-pointer" />
          {user.notifications.some(n => !n.read) && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
          )}
        </div>
        <button onClick={onLogout} className="text-red-500 hover:text-red-400 ml-1">
             <LogOut size={20} />
        </button>
      </div>
    </div>
  );

  const RobotVisual = () => (
    <div className="relative w-48 h-48 mx-auto my-6 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-[spin_10s_linear_infinite]"></div>
      <div className="absolute inset-4 rounded-full border-2 border-yellow-400/30 animate-[spin_7s_linear_infinite_reverse]"></div>
      <div className="absolute inset-8 rounded-full border border-blue-400/50 animate-pulse"></div>
      
      <div className="relative z-10 w-24 h-24 bg-gray-900 rounded-full border-4 border-blue-500 shadow-[0_0_30px_#3b82f6] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent animate-scan"></div>
        <Zap size={40} className={`text-yellow-400 opacity-50`} />
      </div>

      <div className="absolute -bottom-4 bg-gray-900 border border-yellow-400 px-3 py-1 rounded-full text-xs font-bold text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]">
        STANDBY
      </div>
    </div>
  );

  const buildBotSchedule = (activePlans) => {
    const botDay = getBotDaySnapshot();
    const dayKey = botDay.dayKey;

    const cycleBreakdown = [];
    let hasRunning = false;
    let hasPending = false;
    let hasAnalysisOnly = true;
    let allWeekend = activePlans.length > 0;
    let allDone = activePlans.length > 0;
    let roundIndexMax = null;
    let roundsPlannedMax = null;
    let cycleStartedAt = null;

    for (const c of activePlans) {
      const ds = c.dailyState;
      if (!ds) {
        allWeekend = false;
        allDone = false;
        continue;
      }
      if (ds.status !== 'weekend') allWeekend = false;
      if (ds.status !== 'done') allDone = false;
      if (ds.status === 'pending' && ds.dayKey === dayKey) hasPending = true;

      if (ds.status === 'running' && ds.dayKey === dayKey) {
        hasRunning = true;
        if (ds.cycleStartedAt) {
          cycleStartedAt = cycleStartedAt === null ? ds.cycleStartedAt : Math.min(cycleStartedAt, ds.cycleStartedAt);
        }
        const item = ds.sequence?.[ds.cycleIndex];
        if (item?.mode === 'trade') {
          hasAnalysisOnly = false;
          cycleBreakdown.push({ contractId: c.id, profit: Number(item.targetProfit) || 0, planId: c.planId });
        } else if (item) {
          cycleBreakdown.push({ contractId: c.id, profit: 0, planId: c.planId });
        }
        if (typeof item?.roundIndex === 'number') {
          roundIndexMax = roundIndexMax === null ? item.roundIndex : Math.max(roundIndexMax, item.roundIndex);
        }
        if (typeof ds.roundsPlanned === 'number') {
          roundsPlannedMax = roundsPlannedMax === null ? ds.roundsPlanned : Math.max(roundsPlannedMax, ds.roundsPlanned);
        }
      }
    }

    return {
      status: allWeekend ? 'weekend' : allDone ? 'done' : hasRunning ? 'running' : hasPending ? 'pending' : 'idle',
      mode: hasAnalysisOnly ? 'analysis' : 'trade',
      cycleSeconds: 600,
      currentCycleStartedAt: cycleStartedAt,
      cycleTargetProfit: cycleBreakdown.reduce((acc, b) => acc + (Number(b.profit) || 0), 0),
      breakdown: cycleBreakdown,
      round: roundIndexMax === null ? null : roundIndexMax + 1,
      rounds: roundsPlannedMax
    };
  };

  const syncContractsFromLedger = async () => {
    const { data, error } = await supabase.rpc('contracts_sync_from_ledger', { max_rows: 200 });
    if (error) return { ok: false, error: error.message || 'Falha ao sincronizar contratos' };
    return { ok: true, data };
  };

  const listContractsFromDb = async () => {
    const { data, error } = await supabase
      .from('plan_contracts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: error.message || 'Falha ao carregar contratos' };
    return { ok: true, contracts: Array.isArray(data) ? data : [] };
  };

  useEffect(() => {
    if (!user?.email) return;
    if (view === 'admin') return;
    const hasDbContracts = (user.activePlans || []).some(c => c?.supabaseContractId);
    if (!hasDbContracts) return;
    let cancelled = false;

    const load = async () => {
      const res = await listContractsFromDb();
      if (cancelled) return;
      if (!res.ok) return;
      const mapped = (Array.isArray(res.contracts) ? res.contracts : []).map(contractFromDb);
      const dayKey = getNyDayKey();
      if (dayKey) {
        const profitTodayTotal = mapped.reduce((acc, c) => {
          const ds = c?.dailyState;
          if (!ds || ds.dayKey !== dayKey) return acc;
          return acc + (Number(ds.profitToday) || 0);
        }, 0);
        const prevTotal = terminalCreditTotalRef.current;
        if (typeof prevTotal === 'number' && profitTodayTotal > prevTotal + 0.00009) {
          const creditedCount = mapped.reduce((acc, c) => {
            const ds = c?.dailyState;
            if (!ds || ds.dayKey !== dayKey) return acc;
            return acc + ((Number(ds.profitToday) || 0) > 0 ? 1 : 0);
          }, 0);
          setTerminalCreditPulse(p => p + 1);
          setTerminalCreditMeta({ dayKey, creditedCount, totalProfit: profitTodayTotal });
        }
        terminalCreditTotalRef.current = profitTodayTotal;
      }
      setUser(prev => ({ ...prev, activePlans: mapped }));
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.email, view, user.activePlans?.length, lang]);

  useEffect(() => {
    if (!user?.email) return;
    if (view === 'admin') return;
    let cancelled = false;

    const load = async () => {
      const dayKey = String(getNyDayKey() || '').trim();
      if (!dayKey) return;
      const { data, error } = await supabase.rpc('reports_get_unified_feed', {
        p_from_day_key: dayKey,
        p_to_day_key: dayKey,
        p_limit: 200,
        p_offset: 0
      });
      if (cancelled) return;
      if (error) return;

      const rows = Array.isArray(data) ? data : [];
      const items = rows.filter(r => r?.source_table === 'bot_daily_credits').map(r => {
        const ts = r?.ts ? new Date(r.ts).getTime() : Date.now();
        const date = new Date(ts).toLocaleTimeString();
        return {
          id: r.id,
          type: 'hft_profit',
          amount: Number(r?.amount) || 0,
          date,
          desc: r?.meta?.plan_name || t.botDailyCredit,
          meta: r?.meta || {},
          ts
        };
      });

      setUser(prev => {
        const base = Array.isArray(prev.history) ? prev.history : [];
        const merged = [...items, ...base];
        const seen = new Set();
        const deduped = merged.filter(item => {
          const key = item?.id ? String(item.id) : `${item.type}_${item.date}_${item.desc}_${item.amount}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const sorted = deduped.slice().sort((a, b) => (Number(b?.ts) || 0) - (Number(a?.ts) || 0));
        return { ...prev, history: sorted };
      });
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.email, view, user.activePlans?.length, lang]);

  useEffect(() => {
    if (!user?.email) return;
    if (contractsRefreshTick <= 0) return;
    if (contractsRefreshInFlightRef.current) return;
    contractsRefreshInFlightRef.current = true;

    const run = async () => {
      await syncContractsFromLedger().catch(() => null);
      const res = await listContractsFromDb();
      if (!res.ok) return;
      const mapped = (Array.isArray(res.contracts) ? res.contracts : []).map(contractFromDb);
      setUser((prev) => ({ ...prev, activePlans: mapped }));
    };

    run().finally(() => {
      contractsRefreshInFlightRef.current = false;
    });
  }, [contractsRefreshTick, user?.email]);

  const reconcileSupabaseContracts = (activePlans, remoteContracts) => {
    const used = new Set();
    const candidates = (Array.isArray(remoteContracts) ? remoteContracts : []).map(c => ({
      id: c.id,
      plan_id: c.plan_id,
      amount: Number(c.amount),
      start_at_ms: c.start_at ? new Date(c.start_at).getTime() : (c.created_at ? new Date(c.created_at).getTime() : 0)
    }));

    return (activePlans || []).map(local => {
      if (local.supabaseContractId) return local;

      const localStart = Number(local.startAt) || 0;
      const planId = local.planId;
      const amount = Number(local.amount);

      let best = null;
      let bestScore = Infinity;
      for (const c of candidates) {
        if (used.has(c.id)) continue;
        if (c.plan_id !== planId) continue;
        if (!Number.isFinite(c.amount) || c.amount !== amount) continue;
        const diff = Math.abs((c.start_at_ms || 0) - localStart);
        if (diff < bestScore) {
          best = c;
          bestScore = diff;
        }
      }

      if (best && bestScore <= 12 * 60 * 60 * 1000) {
        used.add(best.id);
        return { ...local, supabaseContractId: best.id };
      }

      return local;
    });
  };

  useEffect(() => {
    const missing = (user.activePlans || []).some(c => !c.supabaseContractId);
    if (!user.email || !missing) return;
    if (contractsReconciledRef.current) return;
    contractsReconciledRef.current = true;

    const run = async () => {
      await syncContractsFromLedger().catch(() => null);
      const res = await listContractsFromDb();
      if (!res.ok) {
        contractsReconciledRef.current = false;
        return;
      }
      const remote = Array.isArray(res.contracts) ? res.contracts : [];
      setUser(prev => ({ ...prev, activePlans: reconcileSupabaseContracts(prev.activePlans || [], remote) }));
    };
    run().catch(() => {
      contractsReconciledRef.current = false;
    });
  }, [user.email, user.activePlans?.length]);

  const addDaysIso = (baseIso, deltaDays) => {
    const parts = String(baseIso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
    return dt.toISOString().slice(0, 10);
  };

  const computeBotsRange = () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (!today) return null;
    if (botsRange === 'today') return { from: today, to: today, isToday: true };
    if (botsRange === 'yesterday') {
      const y = addDaysIso(today, -1);
      if (!y) return null;
      return { from: y, to: y, isToday: false };
    }
    if (botsRange === '7d') {
      const from = addDaysIso(today, -6);
      if (!from) return null;
      return { from, to: today, isToday: false };
    }
    if (botsRange === '30d') {
      const from = addDaysIso(today, -29);
      if (!from) return null;
      return { from, to: today, isToday: false };
    }
    return { from: today, to: today, isToday: true };
  };

  useEffect(() => {
    if (!user?.email) return;
    if (view === 'admin') return;
    if (reportsTab !== 'bots') return;
    if (!serverDay?.day_key) return;

    const range = computeBotsRange();
    if (!range) {
      setBotsHistory([]);
      setBotsLoading(false);
      setBotsLoadError(null);
      return;
    }

    const contractIds = (user.activePlans || [])
      .map(c => c?.supabaseContractId)
      .filter(Boolean);
    if (!contractIds.length) {
      setBotsHistory([]);
      setBotsLoading(false);
      setBotsLoadError(null);
      return;
    }

    let cancelled = false;
    setBotsLoading(true);
    setBotsLoadError(null);

    const load = async () => {
      const { data, error } = await supabase.rpc('reports_get_unified_feed', {
        p_from_day_key: range.from,
        p_to_day_key: range.to,
        p_limit: botsRange === '30d' ? 50 : 500,
        p_offset: botsOffset
      });

      if (cancelled) return;
      if (error) {
        if (botsOffset === 0) setBotsHistory([]);
        setBotsLoadError(error.message || t.reportsBotsLoadFail);
        setBotsLoading(false);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      const items = rows.map(r => {
        const ts = r?.ts ? new Date(r.ts).getTime() : Date.now();
        const date = new Date(ts).toLocaleString();
        
        if (r.source_table === 'bot_daily_credits') {
          return {
            id: r.id,
            type: 'hft_profit',
            amount: Number(r.amount) || 0,
            date,
            desc: r.meta?.plan_name || t.botDailyCredit,
            meta: r.meta || {},
            ts
          };
        } else {
          // wallet_ledger mapping
          const kind = String(r.type || '').toLowerCase();
          const asset = String(r.asset || '').toLowerCase();
          const amountRaw = Number(r.amount) || 0;
          const amount = Math.abs(amountRaw);
          const meta = r.meta || {};
          
          if (kind === 'deposit') {
            const net = meta?.network ? ` (${String(meta.network)})` : '';
            return { id: r.id, type: 'deposit', amount, date, desc: `${asset.toUpperCase()}${net}`, meta, ts };
          }
          if (kind === 'withdraw') {
            const status = meta?.status ? String(meta.status) : '';
            const suffix = status ? ` ${status}` : '';
            return { id: r.id, type: 'withdraw', amount, date, desc: `${asset.toUpperCase()}${suffix}`, meta, ts };
          }
          if (kind === 'plan_activation') {
            const planName = meta?.plan_name ? String(meta.plan_name) : 'Plano';
            return { id: r.id, type: 'plan_activation', amount, date, desc: planName, meta, ts };
          }
          if (kind === 'plan_upgrade') {
            return { id: r.id, type: 'plan_upgrade', amount, date, desc: asset.toUpperCase(), meta, ts };
          }
          if (kind === 'unilevel' || kind === 'residual') {
            return { id: r.id, type: kind, amount, date, desc: asset.toUpperCase(), meta, ts };
          }
          if (kind === 'swap' && amountRaw > 0) {
            const direction = meta?.direction ? String(meta.direction) : '';
            if (asset === 'vdt') return { id: r.id, type: 'swap', amount, date, desc: `USD -> ${amount.toFixed(0)} VDT`, meta, ts };
            return { id: r.id, type: 'swap', amount, date, desc: `${direction === 'vdtToUsd' ? 'VDT -> USD' : 'Swap'} ${asset.toUpperCase()}`, meta, ts };
          }
          if (kind === 'vault' || kind === 'game' || kind === 'runner' || kind === 'quantum') {
            if (amount <= 0.00009) return null;
            const type = amountRaw > 0 ? 'game_win' : 'game_loss';
            const baseDesc =
              kind === 'vault' ? 'Vault' :
              (kind === 'runner' || (kind === 'quantum' && String(meta?.game || '').toLowerCase() === 'runner')) ? 'Runner' :
              (kind === 'quantum' ? 'Quantum' : 'Game');
            const cap = (() => {
              if (!meta?.cap_applied) return '';
              const scope = String(meta?.cap_scope || '').toLowerCase();
              if (scope === 'day') return ` (cap ${Number(meta?.cap_max_vdt) || 5} VDT/dia)`;
              return ` (cap ${Number(meta?.cap_round_max_vdt) || Number(meta?.cap_max_vdt) || 5} VDT/rodada)`;
            })();
            return { id: r.id, type, amount, date, desc: `${baseDesc}${cap}`, meta, ts };
          }
          
          // fallback
          return { id: r.id, type: kind, amount, date, desc: asset.toUpperCase(), meta, ts };
        }
      }).filter(Boolean);

      setBotsHistory(prev => botsOffset === 0 ? items : [...prev, ...items]);
      setBotsLoading(false);
    };

    load();
    const interval = range.isToday ? setInterval(load, 5000) : null;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [botsRange, botsOffset, reportsTab, serverDay?.day_key, user?.email, view, lang]);

  const HomeView = () => {
    const [remoteContracts, setRemoteContracts] = useState(null);
    const [remoteContractsError, setRemoteContractsError] = useState(null);
    const [remoteContractsLoading, setRemoteContractsLoading] = useState(false);
    const [supabaseDebug, setSupabaseDebug] = useState(null);
    const [supabaseDebugError, setSupabaseDebugError] = useState(null);
    const [supabaseDebugLoading, setSupabaseDebugLoading] = useState(false);
    const activePlans = user.activePlans || [];
    const totalCapital = activePlans.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const totalAccumulated = activePlans.reduce((acc, c) => acc + (Number(c.accumulated) || 0), 0);
    const totalBalance = user.balances.usdt + user.balances.usdc + totalAccumulated;
    const botDay = getBotDaySnapshot();
    const isAdminHome = isAdmin;
    const dayKeyNow = botDay.dayKey || null;
    const profitTodayFromContracts = activePlans.reduce((acc, c) => {
      const ds = c?.dailyState;
      if (!dayKeyNow || !ds || ds.dayKey !== dayKeyNow) return acc;
      return acc + (Number(ds.profitToday) || 0);
    }, 0);
    const profitTodayFromFeed = (Array.isArray(user.history) ? user.history : []).reduce((acc, tx) => {
      if (tx?.type !== 'hft_profit') return acc;
      const k = tx?.meta?.day_key ? String(tx.meta.day_key) : '';
      if (!dayKeyNow || k !== String(dayKeyNow)) return acc;
      return acc + (Number(tx.amount) || 0);
    }, 0);
    const profitTodayTotal = profitTodayFromFeed > 0.00009 ? profitTodayFromFeed : profitTodayFromContracts;
    const hasCreditedToday = profitTodayTotal > 0.00009;

    const loadSupabaseDebug = async () => {
      try {
        setSupabaseDebugLoading(true);
        setSupabaseDebugError(null);

        const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '')
          .trim()
          .replace(/^['"]|['"]$/g, '')
          .replace(/^<|>$/g, '')
          .replace(/\/+$/, '');
        const anonKeyRaw = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
        const anonKey = (() => {
          let v = anonKeyRaw;
          for (;;) {
            const first = v[0];
            const last = v[v.length - 1];
            const pair =
              first === '<' ? '>' :
              first === '(' ? ')' :
              first === '"' ? '"' :
              first === "'" ? "'" :
              first === '`' ? '`' :
              null;
            if (!pair || last !== pair) break;
            v = v.slice(1, -1).trim();
          }
          const m = v.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
          return m?.[0] || v;
        })();
        const functionsBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : null;
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes?.data?.session?.access_token || null;
        const userRes = await supabase.auth.getUser();
        const authUser = userRes?.data?.user || null;

        const anonPayload = (() => {
          if (!anonKey) return null;
          const parts = String(anonKey).split('.');
          if (parts.length < 2) return null;
          const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const pad = '='.repeat((4 - (b64.length % 4)) % 4);
          const jsonText = atob(b64 + pad);
          return JSON.parse(jsonText);
        })();

        const tokenPayload = (() => {
          if (!token) return null;
          const parts = String(token).split('.');
          if (parts.length < 2) return null;
          const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const pad = '='.repeat((4 - (b64.length % 4)) % 4);
          const jsonText = atob(b64 + pad);
          return JSON.parse(jsonText);
        })();

        setSupabaseDebug({
          supabaseUrl,
          functionsBase,
          anonMeta: anonPayload
            ? {
                ref: anonPayload.ref || null,
                role: anonPayload.role || null,
                iss: anonPayload.iss || null,
                exp: anonPayload.exp || null,
                prefix: anonKey ? String(anonKey).slice(0, 12) : null,
                length: anonKey ? String(anonKey).length : 0
              }
            : {
                ref: null,
                role: null,
                iss: null,
                exp: null,
                prefix: anonKey ? String(anonKey).slice(0, 12) : null,
                length: anonKey ? String(anonKey).length : 0
              },
          authUser: authUser ? { id: authUser.id, email: authUser.email } : null,
          tokenMeta: tokenPayload
            ? {
                iss: tokenPayload.iss || null,
                aud: tokenPayload.aud || null,
                exp: tokenPayload.exp || null
              }
            : null
        });
      } catch (e) {
        setSupabaseDebug(null);
        setSupabaseDebugError(e instanceof Error ? e.message : 'Falha ao coletar diagnóstico');
      } finally {
        setSupabaseDebugLoading(false);
      }
    };

    const yieldTodayPct = (() => {
      if (!totalCapital) return 0;
      return (profitTodayTotal / totalCapital) * 100;
    })();

    const localeForLang = (lang) => {
      if (lang === 'es') return 'es-ES';
      if (lang === 'en') return 'en-US';
      return 'pt-BR';
    };

    const washNow = new Date(serverNowMsRef.current ?? Date.now());
    const washTime = new Intl.DateTimeFormat(localeForLang(lang), {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(washNow);
    const washWeekday = new Intl.DateTimeFormat(localeForLang(lang), { timeZone: 'America/New_York', weekday: 'long' }).format(washNow);
    const washDate = new Intl.DateTimeFormat(localeForLang(lang), { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(washNow);

    const terminalStatus = (() => {
      if (!botDay.isBusinessDay) return 'weekend';
      if (hasCreditedToday) return 'done';
      return 'waiting';
    })();

    const terminalSchedule = {
      status: terminalStatus,
      creditAt: '19:00',
      washingtonTime: washTime,
      weekdayLabel: washWeekday,
      dateLabel: washDate,
      totals: {
        totalCapital,
        totalAccumulated,
        profitToday: profitTodayTotal
      }
    };

    return (
      <div className="space-y-6 animate-fadeIn pb-24">
        <div className="text-center mt-4">
          <p className="text-gray-400 text-sm">{t.balance}</p>
          <p className="text-gray-500 text-xs mt-1">{t.balanceSubtitle}</p>
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-lg">
            {formatCurrency(totalBalance)}
          </h1>
          {activePlans.length > 0 && (
            <div className="text-green-400 text-sm mt-1 animate-pulse">
              +{formatCurrency(totalAccumulated)} {t.profit}
            </div>
          )}
        </div>

        <div className="px-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.homeHftTotal}</p>
              <p className="text-green-300 font-bold mt-1">{formatCurrency(totalAccumulated)}</p>
            </div>
            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.homeResidualTotal}</p>
              <p className="text-purple-300 font-bold mt-1">{formatCurrency(teamStats.residual_total || 0)}</p>
            </div>
            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.homeUnilevelTotal}</p>
              <p className="text-blue-300 font-bold mt-1">{formatCurrency(teamStats.unilevel_total || 0)}</p>
            </div>
            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.homeTotalBalance}</p>
              <p className="text-yellow-300 font-bold mt-1">{formatCurrency(totalBalance)}</p>
            </div>
          </div>
        </div>

        {activePlans.length > 0 ? (
          <TradingTerminal
            ref={terminalRef}
            schedule={terminalSchedule}
            creditPulse={terminalCreditPulse}
            creditMeta={terminalCreditMeta}
            t={t}
          />
        ) : (
          <RobotVisual />
        )}

        <div className="flex flex-col items-center gap-3">
          <button 
            onClick={() => setView('plans')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-10 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.6)] transform hover:scale-105 transition active:scale-95 border-b-4 border-blue-800"
          >
            {activePlans.length > 0 ? t.addPlan : t.choosePlan}
          </button>

          {activePlans.length > 0 && (
            <div className="text-xs text-gray-200 bg-gray-900/40 border border-gray-800 px-3 py-2 rounded-lg text-center max-w-md">
              <span className="font-bold text-gray-100">{t.botTimeRuleTitle}</span>
              <span className="text-gray-300"> {t.botTimeRuleBody}</span>
            </div>
          )}

          {activePlans.length > 0 && (
            <div className="flex gap-2">
              {!isAdminHome && activePlans.some(c => !c.supabaseContractId) && (
                <button
                  onClick={async () => {
                    try {
                      setRemoteContractsLoading(true);
                      setRemoteContractsError(null);
                      const syncRes = await syncContractsFromLedger();
                      if (!syncRes.ok) {
                        setRemoteContractsError(syncRes.error || 'Erro ao sincronizar');
                        triggerNotification('Plano', syncRes.error || 'Erro ao sincronizar contrato no banco', 'error');
                      }

                      const listRes = await listContractsFromDb();
                      if (!listRes.ok) {
                        setRemoteContractsError(listRes.error || 'Erro ao carregar contratos');
                        triggerNotification('Plano', listRes.error || 'Erro ao carregar contratos do banco', 'error');
                        return;
                      }

                      const remote = Array.isArray(listRes.contracts) ? listRes.contracts : [];
                      const nextLocal = reconcileSupabaseContracts(activePlans, remote);
                      setUser(prev => ({ ...prev, activePlans: nextLocal }));

                      triggerNotification('Plano', 'Sincronização concluída.', 'success');
                    } finally {
                      setRemoteContractsLoading(false);
                    }
                  }}
                  className={`text-xs px-3 py-2 rounded-lg border transition ${
                    remoteContractsLoading
                      ? 'bg-gray-900/40 border-gray-800 text-gray-600 cursor-wait'
                      : 'bg-yellow-700/40 border-yellow-600 text-yellow-100 hover:bg-yellow-700/60'
                  }`}
                  disabled={remoteContractsLoading}
                >
                  Sincronizar Plano
                </button>
              )}
            </div>
          )}
        </div>

        {isAdmin && (remoteContracts || remoteContractsError) && (
          <div className="px-4">
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-200 font-bold">{t.contractsSupabaseTitle}</span>
                <span className="text-gray-500 text-xs font-mono">
                  {remoteContracts ? `${remoteContracts.length} ${t.records}` : t.errorLabel}
                </span>
              </div>
              {remoteContractsError && (
                <div className="mt-2 text-red-400 text-xs font-mono">{remoteContractsError}</div>
              )}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={loadSupabaseDebug}
                  className={`text-[10px] px-3 py-2 rounded-lg border transition font-mono ${
                    supabaseDebugLoading
                      ? 'bg-gray-900/40 border-gray-800 text-gray-600 cursor-wait'
                      : 'bg-gray-800/60 border-gray-700 text-gray-200 hover:bg-gray-800'
                  }`}
                  disabled={supabaseDebugLoading}
                >
                  Diagnóstico Supabase
                </button>
              </div>
              {supabaseDebugError && (
                <div className="mt-2 text-red-400 text-xs font-mono">{supabaseDebugError}</div>
              )}
              {supabaseDebug && (
                <div className="mt-3 bg-gray-950/40 border border-gray-800 rounded-lg p-3 text-[10px] font-mono space-y-1">
                  <div className="text-gray-400">VITE_SUPABASE_URL: <span className="text-gray-200">{supabaseDebug.supabaseUrl || '—'}</span></div>
                  <div className="text-gray-400">Functions base: <span className="text-gray-200">{supabaseDebug.functionsBase || '—'}</span></div>
                <div className="text-gray-400">Anon ref: <span className="text-gray-200">{supabaseDebug.anonMeta?.ref || '—'}</span></div>
                <div className="text-gray-400">Anon role: <span className="text-gray-200">{supabaseDebug.anonMeta?.role || '—'}</span></div>
                <div className="text-gray-400">Anon iss: <span className="text-gray-200">{supabaseDebug.anonMeta?.iss || '—'}</span></div>
                <div className="text-gray-400">Anon exp: <span className="text-gray-200">{supabaseDebug.anonMeta?.exp ? new Date(Number(supabaseDebug.anonMeta.exp) * 1000).toISOString() : '—'}</span></div>
                <div className="text-gray-400">Anon key: <span className="text-gray-200">{supabaseDebug.anonMeta?.prefix ? `${supabaseDebug.anonMeta.prefix}… (${supabaseDebug.anonMeta.length})` : '—'}</span></div>
                  <div className="text-gray-400">Auth user: <span className="text-gray-200">{supabaseDebug.authUser?.email || '—'}</span></div>
                  <div className="text-gray-400">Auth UID: <span className="text-gray-200">{supabaseDebug.authUser?.id || '—'}</span></div>
                  <div className="text-gray-400">JWT iss: <span className="text-gray-200">{supabaseDebug.tokenMeta?.iss || '—'}</span></div>
                  <div className="text-gray-400">JWT aud: <span className="text-gray-200">{supabaseDebug.tokenMeta?.aud || '—'}</span></div>
                  <div className="text-gray-400">JWT exp: <span className="text-gray-200">{supabaseDebug.tokenMeta?.exp ? new Date(Number(supabaseDebug.tokenMeta.exp) * 1000).toISOString() : '—'}</span></div>
                </div>
              )}
              {Array.isArray(remoteContracts) && remoteContracts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {remoteContracts.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex justify-between items-center bg-gray-950/40 border border-gray-800 rounded-lg p-3">
                      <div className="flex flex-col">
                        <span className="text-gray-100 font-bold text-xs">{c.plan_name}</span>
                        <span className="text-gray-500 text-[10px] font-mono">{c.id}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-gray-200 font-mono text-xs">${Number(c.amount).toFixed(2)}</span>
                        <span className="text-gray-500 text-[10px]">{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(remoteContracts) && remoteContracts.length === 0 && (
                <div className="mt-2 text-gray-500 text-xs">Nenhum contrato encontrado.</div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 px-4 mb-6">
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center">
             <Activity className="text-blue-400 mb-2" size={24} />
            <span className="text-xs text-gray-400">{t.yieldToday}</span>
             <span className="text-white font-bold text-lg">
               {`${yieldTodayPct >= 0 ? '+' : ''}${yieldTodayPct.toFixed(2)}%`}
             </span>
             <span className="text-green-400 text-xs font-mono mt-1">
               +{formatCurrency(profitTodayTotal)}
             </span>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center">
             <Users className="text-purple-400 mb-2" size={24} />
             <span className="text-xs text-gray-400">{t.activeDirects}</span>
             <span className="text-white font-bold text-lg">{teamStats.directs}</span>
          </div>
        </div>

        <div className="px-4 pb-6">
          <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold text-sm">{t.latestActivity}</h3>
              <button onClick={() => setView('reports')} className="text-xs text-blue-400 hover:text-blue-300">{t.viewAll}</button>
          </div>
          <div className="space-y-2">
              {user.history.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="bg-gray-800/40 p-3 rounded-lg flex justify-between items-center border border-gray-700/30">
                      <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.type.includes('profit') ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                              {item.type.includes('profit') ? <TrendingUp size={14} /> : <Activity size={14} />}
                          </div>
                          <div>
                              <p className="text-white text-xs font-bold capitalize">{item.desc || item.type}</p>
                              <p className="text-gray-500 text-[10px]">{item.date}</p>
                          </div>
                      </div>
                      <span className={`text-xs font-mono font-bold ${item.type.includes('withdraw') || item.type.includes('activation') ? 'text-red-400' : 'text-green-400'}`}>
                          {item.type.includes('withdraw') || item.type.includes('activation') ? '-' : '+'}${Number(item.amount).toFixed(2)}
                      </span>
                  </div>
              ))}
              {user.history.length === 0 && (
                  <p className="text-gray-500 text-xs text-center py-2">{t.noRecentActivity}</p>
              )}
          </div>
        </div>
      </div>
    );
  };

  const SupportView = useMemo(() => function SupportView({ t, setView, triggerNotification, initialSelectedId, onConsumeInitialSelectedId }) {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [thread, setThread] = useState({ ticket: null, messages: [] });
    const [reply, setReply] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [attachmentsError, setAttachmentsError] = useState(null);
    const initialAppliedRef = useRef(false);

    const loadMyTickets = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.rpc('support_list_my_tickets', { limit_rows: 50 });
      if (error) {
        setError(error.message || t.supportLoadFail);
        setLoading(false);
        return;
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      setTickets(items);
      setLoading(false);
      if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
    };

    useEffect(() => { loadMyTickets(); }, []);

    useEffect(() => {
      if (initialAppliedRef.current) return;
      if (!initialSelectedId) return;
      initialAppliedRef.current = true;
      setSelectedId(initialSelectedId);
      onConsumeInitialSelectedId?.();
    }, [initialSelectedId]);

    useEffect(() => {
      if (!selectedId) { setThread({ ticket: null, messages: [] }); return; }
      let cancelled = false;
      const run = async () => {
        const { data, error } = await supabase.rpc('support_get_ticket', { ticket_id: selectedId });
        if (cancelled) return;
        if (!error) setThread({ ticket: data?.ticket || null, messages: Array.isArray(data?.messages) ? data.messages : [] });
      };
      run();
      return () => { cancelled = true; };
    }, [selectedId]);

    useEffect(() => {
      if (!selectedId) {
        setAttachments([]);
        setAttachmentsError(null);
        return;
      }
      let cancelled = false;
      const run = async () => {
        setAttachmentsError(null);
        const { data, error } = await supabase.rpc('support_list_attachments', { ticket_id: selectedId });
        if (cancelled) return;
        if (error) {
          setAttachments([]);
          setAttachmentsError(error.message || 'Falha ao carregar anexos');
          return;
        }
        setAttachments(Array.isArray(data?.items) ? data.items : []);
      };
      run();
      return () => { cancelled = true; };
    }, [selectedId]);

    const openAttachment = async (att) => {
      const path = String(att?.storage_path || '').trim();
      if (!path) return;
      const { data, error } = await supabase.storage.from('support-proofs').createSignedUrl(path, 60 * 10);
      if (error || !data?.signedUrl) {
        triggerNotification(t.support, error?.message || 'Falha ao abrir anexo', 'error');
        return;
      }
      openExternalUrl(data.signedUrl, { title: t.support || 'Suporte' });
    };

    const createTicket = async () => {
      if (!subject.trim() || !body.trim()) return;
      const { data, error } = await supabase.rpc('support_create_ticket', { subject: subject.trim(), body: body.trim() });
      if (error) {
        triggerNotification(t.support, error.message || t.supportCreateFail, 'error');
        return;
      }
      setSubject('');
      setBody('');
      await loadMyTickets();
      if (data?.ticket?.id) setSelectedId(data.ticket.id);
      triggerNotification(t.support, t.supportTicketCreated, 'success');
    };

    const sendReply = async () => {
      if (!selectedId || !reply.trim()) return;
      const { error } = await supabase.rpc('support_add_message', { ticket_id: selectedId, body: reply.trim() });
      if (error) {
        triggerNotification(t.support, error.message || t.supportSendFail, 'error');
        return;
      }
      setReply('');
      const { data } = await supabase.rpc('support_get_ticket', { ticket_id: selectedId });
      setThread({ ticket: data?.ticket || null, messages: Array.isArray(data?.messages) ? data.messages : [] });
      await loadMyTickets();
    };

    return (
      <div className="px-4 pb-24 pt-4">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setView('menu')} className="text-gray-400 hover:text-white"><ChevronRight className="rotate-180" /></button>
          <h2 className="text-2xl font-bold text-white">{t.support}</h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[340px,1fr] gap-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">{t.supportNewTicket}</p>
            <input
              type="text"
              placeholder={t.supportSubjectPlaceholder}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none mb-2"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              placeholder={t.supportDescribePlaceholder}
              className="w-full min-h-[96px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none mb-2"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button onClick={createTicket} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg">{t.supportOpenTicket}</button>
            <div className="mt-4 border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wider text-gray-400">{t.supportMyTickets}</p>
                <p className="text-[10px] text-gray-500">{loading ? '...' : `${tickets.length} ${t.records}`}</p>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {tickets.map((tkt) => (
                  <button
                    key={tkt.id}
                    onClick={() => setSelectedId(tkt.id)}
                    className={`w-full text-left rounded-lg border p-3 transition ${selectedId === tkt.id ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-950/50 border-gray-800 hover:border-gray-700'}`}
                  >
                    <p className="text-sm text-white font-bold truncate">{tkt.subject}</p>
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>{tkt.status}</span>
                      <span>{new Date(tkt.last_message_at).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
                {!tickets.length && !loading && <div className="text-xs text-gray-500">{t.adminNoTickets}</div>}
                {error && <div className="text-xs text-red-400">{error}</div>}
              </div>
            </div>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            {!thread.ticket ? (
              <div className="text-sm text-gray-500">{t.supportSelectTicketHint}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold">{thread.ticket.subject}</h3>
                  <div className="text-[11px] px-2 py-1 rounded border border-gray-700 text-gray-300">{thread.ticket.status}</div>
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {thread.messages.map((m) => (
                    <div key={m.id} className={`p-3 rounded-lg border ${m.sender_role === 'admin' ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-950/50 border-gray-800'}`}>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                        <span>{m.sender_role}</span>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{m.body}</p>
                      {(Array.isArray(attachments) ? attachments : []).some(a => a.message_id === m.id) && (
                        <div className="mt-2 space-y-1">
                          {(Array.isArray(attachments) ? attachments : [])
                            .filter(a => a.message_id === m.id)
                            .map((a) => (
                              <button
                                key={a.id}
                                onClick={() => openAttachment(a)}
                                className="text-xs text-blue-300 hover:text-blue-200 underline break-all text-left"
                              >
                                {a.original_name || a.storage_path}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {!thread.messages.length && <div className="text-xs text-gray-500">{t.adminNoMessages}</div>}
                  {attachmentsError && <div className="text-xs text-red-400">{attachmentsError}</div>}
                </div>
                <div>
                  <textarea
                    placeholder={t.supportWriteMessage}
                    className="w-full min-h-[80px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none mb-2"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <button onClick={sendReply} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg">{t.adminSend}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, []);

  const NotificationsPanel = () => (
    <>
      {/* Overlay Backdrop */}
      {showNotif && (
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[55] animate-fadeIn"
          onClick={() => setShowNotif(false)}
        ></div>
      )}
      
      {/* Panel */}
      <div className={`absolute inset-y-0 right-0 w-full bg-gray-900 shadow-2xl z-[60] transform transition-transform duration-300 border-l border-gray-700 ${showNotif ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <h3 className="text-white font-bold flex items-center gap-2">
             <Bell size={16} className="text-blue-400" /> 
             {t.notifications}
          </h3>
          <button 
            onClick={() => setShowNotif(false)} 
            className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3 h-[calc(100%-60px)] overflow-y-auto custom-scrollbar pb-20">
          {user.notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
               <Bell size={32} className="opacity-20" />
               <p className="text-xs">{t.notificationsEmpty}</p>
            </div>
          ) : (
            user.notifications.map(n => (
              <div key={n.id} className={`bg-gray-800/50 p-3 rounded-lg border-l-4 ${n.type === 'error' ? 'border-red-500' : n.type === 'success' ? 'border-green-500' : 'border-blue-500'} hover:bg-gray-800 transition`}>
                <div className="flex justify-between items-start mb-1">
                   <h4 className="text-gray-200 text-sm font-bold">{n.title}</h4>
                   <span className="text-[10px] text-gray-500">{n.time}</span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">{n.msg}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  const MenuView = () => (
    <div className="px-4 pb-24 pt-4 animate-fadeIn">
      <h2 className="text-2xl font-bold text-white mb-6">{t.navMenu}</h2>
      
      <div className="grid grid-cols-1 gap-4">
        <button onClick={() => setView('settings')} className="bg-gray-800 hover:bg-gray-700 p-5 rounded-xl flex items-center gap-4 transition border border-gray-700">
          <div className="bg-blue-500/20 p-3 rounded-full text-blue-400">
            <Settings size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-white font-bold text-lg">{t.settings}</h3>
            <p className="text-gray-400 text-xs">{t.menuSettingsDesc}</p>
          </div>
          <ChevronRight className="ml-auto text-gray-500" />
        </button>

        {isAdmin && (
          <button onClick={() => setView('admin')} className="bg-gray-800 hover:bg-gray-700 p-5 rounded-xl flex items-center gap-4 transition border border-blue-900/60">
            <div className="bg-blue-500/20 p-3 rounded-full text-blue-400">
              <ShieldCheck size={24} />
            </div>
            <div className="text-left">
              <h3 className="text-white font-bold text-lg">{t.adminPanel}</h3>
              <p className="text-gray-400 text-xs">{t.adminPanelDesc}</p>
            </div>
            <ChevronRight className="ml-auto text-gray-500" />
          </button>
        )}

        <button onClick={() => setView('team')} className="bg-gray-800 hover:bg-gray-700 p-5 rounded-xl flex items-center gap-4 transition border border-gray-700">
          <div className="bg-purple-500/20 p-3 rounded-full text-purple-400">
            <Users size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-white font-bold text-lg">{t.team}</h3>
            <p className="text-gray-400 text-xs">{t.menuTeamDesc}</p>
          </div>
          <ChevronRight className="ml-auto text-gray-500" />
        </button>

        <button onClick={() => setView('reports')} className="bg-gray-800 hover:bg-gray-700 p-5 rounded-xl flex items-center gap-4 transition border border-gray-700">
          <div className="bg-green-500/20 p-3 rounded-full text-green-400">
            <FileText size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-white font-bold text-lg">{t.reports}</h3>
            <p className="text-gray-400 text-xs">{t.transactions}, {t.botOps}</p>
          </div>
          <ChevronRight className="ml-auto text-gray-500" />
        </button>

        <button onClick={() => setView('support')} className="bg-gray-800 hover:bg-gray-700 p-5 rounded-xl flex items-center gap-4 transition border border-gray-700">
          <div className="bg-indigo-500/20 p-3 rounded-full text-indigo-400">
            <ShieldCheck size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-white font-bold text-lg">{t.support}</h3>
            <p className="text-gray-400 text-xs">{t.menuSupportDesc}</p>
          </div>
          <ChevronRight className="ml-auto text-gray-500" />
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-900 rounded-xl border border-gray-800 text-center">
        <p className="text-gray-500 text-xs">{t.appVersionLabel}: 1.6.0 (HFT Live)</p>
        <p className="text-gray-600 text-[10px] mt-1">ID: {user.name}</p>
      </div>
    </div>
  );

  const SettingsView = useMemo(
    () =>
      function SettingsView({ t, user, isAdmin, setView, handleSaveSettings }) {
        const [localWallets, setLocalWallets] = useState(() => ({
          usdt_bep20: String(user?.wallets?.usdt_bep20 || ''),
          usdc_arbitrum: String(user?.wallets?.usdc_arbitrum || '')
        }));
        const [localFinPass, setLocalFinPass] = useState('');

        useEffect(() => {
          setLocalWallets({
            usdt_bep20: String(user?.wallets?.usdt_bep20 || ''),
            usdc_arbitrum: String(user?.wallets?.usdc_arbitrum || '')
          });
        }, [user?.wallets?.usdt_bep20, user?.wallets?.usdc_arbitrum]);

        const togglePhoto = () => {
          const dummyPhoto = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&auto=format&fit=crop&q=60';
          handleSaveSettings({
            wallets: localWallets,
            photoUrl: user.photoUrl ? null : dummyPhoto
          });
        };

        const handleSave = async () => {
          await handleSaveSettings({
            wallets: {
              usdt_bep20: String(localWallets?.usdt_bep20 || ''),
              usdc_arbitrum: String(localWallets?.usdc_arbitrum || '')
            },
            financialPassword: localFinPass
          });
          setLocalFinPass('');
        };

        return (
          <div className="px-4 pb-24 pt-4">
        <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setView('menu')} className="text-gray-400 hover:text-white"><ChevronRight className="rotate-180" /></button>
            <h2 className="text-2xl font-bold text-white">{t.settings}</h2>
        </div>

        {/* Perfil Section */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6 flex flex-col items-center">
            <div className="relative mb-4 group cursor-pointer" onClick={togglePhoto}>
                <div className="w-24 h-24 rounded-full bg-gray-700 border-4 border-blue-500 flex items-center justify-center overflow-hidden">
                    {user.photoUrl ? (
                        <img src={user.photoUrl} alt="User" className="w-full h-full object-cover" />
                    ) : (
                        <User size={48} className="text-gray-400" />
                    )}
                </div>
                <div className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full border-2 border-gray-800">
                    <Camera size={14} className="text-white" />
                </div>
            </div>
            <h3 className="text-xl font-bold text-white">{user.name}</h3>
            <p className="text-gray-400 text-sm mb-4">{user.email}</p>
            <div className="w-full max-w-md mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t.settingsUsernameLabel}</p>
                <p className="text-xs text-gray-200 font-mono mt-1">{user.username || '—'}</p>
              </div>
              <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t.settingsSponsorLabel}</p>
                <p className="text-xs text-gray-200 font-mono mt-1">{user.sponsor_username || user.sponsor_code || '—'}</p>
              </div>
            </div>
            <button onClick={togglePhoto} className="text-xs text-blue-400 hover:text-blue-300 underline">
                {t.changePhoto}
            </button>
        </div>

        {/* Segurança Section */}
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 mb-6">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2">
                <Lock size={18} className="text-yellow-400" />
                <h3 className="text-white font-bold">{t.security}</h3>
            </div>
            <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase font-bold">{t.finPassword}</label>
                <div className="flex gap-2">
                    <input 
                        type="password" 
                        placeholder={user.pinIsSet ? "******" : t.settingsFinPassPlaceholderNew}
                        className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white w-full text-sm focus:border-blue-500 focus:outline-none"
                        value={localFinPass}
                        onChange={(e) => setLocalFinPass(e.target.value)}
                    />
                </div>
                <p className="text-[10px] text-gray-500">{t.settingsFinPassHelp}</p>
                <p className={`text-[10px] ${user.pinIsSet ? 'text-green-400' : 'text-yellow-400'}`}>
                  {user.pinIsSet ? 'Senha financeira cadastrada.' : 'Senha financeira não cadastrada.'}
                </p>
            </div>
        </div>

        {/* Carteiras Section */}
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 mb-6">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2">
                <CreditCard size={18} className="text-green-400" />
                <h3 className="text-white font-bold">{t.wallets}</h3>
            </div>
            
            <div className="space-y-4">
                {/* USDT BEP-20 */}
                <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      USDT (BEP-20){localWallets.usdt_bep20 ? ' · Salva' : ''}
                    </label>
                    <input 
                        type="text" 
                        placeholder="0x..." 
                        className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white w-full text-xs font-mono focus:border-green-500 focus:outline-none"
                        value={localWallets.usdt_bep20}
                        onChange={(e) => setLocalWallets({...localWallets, usdt_bep20: e.target.value})}
                    />
                </div>
                 {/* USDC ARBITRUM */}
                 <div>
                    <label className="text-xs text-blue-400 block mb-1 font-bold">
                      USDC (ARBITRUM){localWallets.usdc_arbitrum ? ' · Salva' : ''}
                    </label>
                    <input 
                        type="text" 
                        placeholder="0x..." 
                        className="bg-gray-900 border border-blue-900 rounded-lg p-3 text-white w-full text-xs font-mono focus:border-blue-500 focus:outline-none"
                        value={localWallets.usdc_arbitrum}
                        onChange={(e) => setLocalWallets({...localWallets, usdc_arbitrum: e.target.value})}
                    />
                </div>
            </div>
        </div>

        {isAdmin && (
          <div className="bg-gray-800 p-5 rounded-xl border border-blue-900/60 mb-6">
            <div className="flex items-center gap-2 mb-4 border-b border-blue-900/40 pb-2">
              <ShieldCheck size={18} className="text-blue-400" />
              <h3 className="text-white font-bold">{t.settingsAdminCardTitle}</h3>
            </div>
            <button
              onClick={() => setView('admin')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg"
            >
              {t.settingsAccessAdmin}
            </button>
          </div>
        )}

        <button 
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg border-b-4 border-blue-800 active:border-b-0 active:mt-1 transition-all flex items-center justify-center gap-2"
        >
            <Save size={18} /> {t.save}
        </button>
          </div>
        );
      },
    []
  );

  const AdminPanelView = useMemo(() => function AdminPanelView({ t, isAdmin, adminPerms, setView, triggerNotification, toNumber, loadAdminUsers, loadAdminUserDetail, walletGate, loadWalletGate, walletGateLoading }) {
    const [adminSearch, setAdminSearch] = useState('');
    const [adminUsers, setAdminUsers] = useState([]);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminError, setAdminError] = useState(null);
    const [selectedAdminUserId, setSelectedAdminUserId] = useState(null);
    const [adminDetail, setAdminDetail] = useState(null);
    const [adminDetailLoading, setAdminDetailLoading] = useState(false);
    const [adminDetailError, setAdminDetailError] = useState(null);
    const [adminEdit, setAdminEdit] = useState({ name: '', username: '', sponsor_code: '', lang: 'en' });
    const [adminBlockReason, setAdminBlockReason] = useState('');
    const [adminActionLoading, setAdminActionLoading] = useState(false);
    const [adminTab, _setAdminTab] = useState(() => adminTabPersistRef.current || 'usuarios');
    const setAdminTab = (tab) => {
      const next = String(tab || 'usuarios');
      adminTabPersistRef.current = next;
      _setAdminTab(next);
    };
    const canWithdrawView = Boolean(adminPerms?.can_withdraw_view || adminPerms?.can_withdraw_manage || adminPerms?.can_withdraw_approve || adminPerms?.is_superadmin);
    const canWithdrawManage = Boolean(adminPerms?.can_withdraw_manage || adminPerms?.is_superadmin);
    const canWithdrawApprove = Boolean(adminPerms?.can_withdraw_approve || adminPerms?.is_superadmin);

    useEffect(() => {
      if (adminTab === 'saques' && !canWithdrawView) setAdminTab('usuarios');
    }, [adminTab, canWithdrawView]);
    const [adminGlobal, setAdminGlobal] = useState(null);
    const [adminGlobalLoading, setAdminGlobalLoading] = useState(false);
    const [adminGlobalError, setAdminGlobalError] = useState(null);
    const [supportSearch, setSupportSearch] = useState('');
    const [supportStatus, setSupportStatus] = useState('');
    const [supportTickets, setSupportTickets] = useState([]);
    const [supportLoading, setSupportLoading] = useState(false);
    const [supportError, setSupportError] = useState(null);
    const [supportDepositOverview, setSupportDepositOverview] = useState([]);
    const [supportDepositOverviewLoading, setSupportDepositOverviewLoading] = useState(false);
    const [supportDepositOverviewError, setSupportDepositOverviewError] = useState(null);
    const [supportDepositSyncing, setSupportDepositSyncing] = useState({});
    const [supportSelectedId, setSupportSelectedId] = useState(null);
    const [supportThread, setSupportThread] = useState({ ticket: null, messages: [] });
    const [supportThreadLoading, setSupportThreadLoading] = useState(false);
    const [supportThreadError, setSupportThreadError] = useState(null);
    const [supportAttachments, setSupportAttachments] = useState([]);
    const [supportAttachmentsError, setSupportAttachmentsError] = useState(null);
    const [supportReply, setSupportReply] = useState('');
    const [supportStatusSaving, setSupportStatusSaving] = useState(false);
    const [auditTable, setAuditTable] = useState('');
    const [auditLimit, setAuditLimit] = useState(120);
    const [auditRows, setAuditRows] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState(null);
    const [botDailyDayKey, setBotDailyDayKey] = useState('');
    const [botDailyLimit, setBotDailyLimit] = useState(200);
    const [botDailyRows, setBotDailyRows] = useState([]);
    const [botDailyLoading, setBotDailyLoading] = useState(false);
    const [botDailyError, setBotDailyError] = useState(null);
    const [botDailyAudit, setBotDailyAudit] = useState(null);
    const [botDailyAuditLoading, setBotDailyAuditLoading] = useState(false);
    const [botDailyAuditError, setBotDailyAuditError] = useState(null);
    const [withdrawQueueSearch, setWithdrawQueueSearch] = useState('');
    const [withdrawQueueStatus, setWithdrawQueueStatus] = useState('pending');
    const [withdrawQueueRows, setWithdrawQueueRows] = useState([]);
    const [withdrawQueueLoading, setWithdrawQueueLoading] = useState(false);
    const [withdrawQueueError, setWithdrawQueueError] = useState(null);
    const [withdrawQueueRemember, setWithdrawQueueRemember] = useState(false);
    const [adminLogsSearch, setAdminLogsSearch] = useState('');
    const [adminLogsAction, setAdminLogsAction] = useState('');
    const [adminLogsFromDay, setAdminLogsFromDay] = useState('');
    const [adminLogsToDay, setAdminLogsToDay] = useState('');
    const [adminLogsRows, setAdminLogsRows] = useState([]);
    const [adminLogsLoading, setAdminLogsLoading] = useState(false);
    const [adminLogsError, setAdminLogsError] = useState(null);
    const [sponsorshipLookup, setSponsorshipLookup] = useState('');
    const [sponsorshipAmount, setSponsorshipAmount] = useState('');
    const [sponsorshipAsset, setSponsorshipAsset] = useState('usdt');
    const [sponsorshipNote, setSponsorshipNote] = useState('');
    const [sponsorshipStatus, setSponsorshipStatus] = useState(null);
    const [sponsorshipStatusLoading, setSponsorshipStatusLoading] = useState(false);
    const [sponsorshipStatusError, setSponsorshipStatusError] = useState(null);
    const [sponsorshipOverview, setSponsorshipOverview] = useState(null);
    const [sponsorshipOverviewLoading, setSponsorshipOverviewLoading] = useState(false);
    const [sponsorshipOverviewError, setSponsorshipOverviewError] = useState(null);
    const [walletPrelaunchUntil, setWalletPrelaunchUntil] = useState('');
    const [walletPrelaunchNote, setWalletPrelaunchNote] = useState('');
    const [walletPrelaunchSaving, setWalletPrelaunchSaving] = useState(false);
    const [walletPrelaunchError, setWalletPrelaunchError] = useState(null);
    const [nowHealthLoading, setNowHealthLoading] = useState(false);
    const [nowSyncValue, setNowSyncValue] = useState('');
    const [nowSyncLoading, setNowSyncLoading] = useState(false);
    const [nowExceptions, setNowExceptions] = useState([]);
    const [nowExceptionsLoading, setNowExceptionsLoading] = useState(false);
    const [nowResolveOrderId, setNowResolveOrderId] = useState('');
    const [nowResolveNote, setNowResolveNote] = useState('');
    const [nowResolveLoading, setNowResolveLoading] = useState(false);
    const [depositReverseLedgerId, setDepositReverseLedgerId] = useState('');
    const [depositReverseNote, setDepositReverseNote] = useState('');
    const [depositReverseLoading, setDepositReverseLoading] = useState(false);
    const [suspiciousDeposits, setSuspiciousDeposits] = useState([]);
    const [suspiciousDepositsLoading, setSuspiciousDepositsLoading] = useState(false);
    const [suspiciousDepositsError, setSuspiciousDepositsError] = useState(null);

    const loadWithdrawQueue = async ({ search = withdrawQueueSearch, status = withdrawQueueStatus } = {}) => {
      setWithdrawQueueLoading(true);
      setWithdrawQueueError(null);
      const { data, error } = await supabase.rpc('admin_withdraw_queue', {
        search_text: String(search || '').trim() || null,
        status_filter: String(status || 'pending'),
        limit_rows: 80,
        offset_rows: 0
      });
      if (error) {
        setWithdrawQueueRows([]);
        setWithdrawQueueError(error.message || 'Falha ao carregar fila de saques');
        setWithdrawQueueLoading(false);
        return;
      }
      setWithdrawQueueRows(Array.isArray(data?.items) ? data.items : []);
      setWithdrawQueueLoading(false);
    };

    const loadAdminLogs = async () => {
      setAdminLogsLoading(true);
      setAdminLogsError(null);
      const { data, error } = await supabase.rpc('admin_logs_list', {
        p_search: String(adminLogsSearch || '').trim() || null,
        p_action: String(adminLogsAction || '').trim() || null,
        p_from_day: adminLogsFromDay ? adminLogsFromDay : null,
        p_to_day: adminLogsToDay ? adminLogsToDay : null,
        p_limit: 200,
        p_offset: 0
      });
      if (error) {
        setAdminLogsRows([]);
        setAdminLogsError(error.message || 'Falha ao carregar logs');
        setAdminLogsLoading(false);
        return;
      }
      setAdminLogsRows(Array.isArray(data?.items) ? data.items : []);
      setAdminLogsLoading(false);
    };

    const loadSponsorshipStatus = async (userId) => {
      if (!userId) {
        setSponsorshipStatus(null);
        setSponsorshipStatusError(null);
        return;
      }
      setSponsorshipStatusLoading(true);
      setSponsorshipStatusError(null);
      const { data, error } = await supabase.rpc('admin_sponsorship_status', { target_user_id: userId });
      if (error) {
        setSponsorshipStatus(null);
        setSponsorshipStatusError(error.message || 'Falha ao carregar patrocínios');
        setSponsorshipStatusLoading(false);
        return;
      }
      setSponsorshipStatus(data || null);
      setSponsorshipStatusLoading(false);
    };

    const loadSponsorshipOverview = async () => {
      setSponsorshipOverviewLoading(true);
      setSponsorshipOverviewError(null);
      const { data, error } = await supabase.rpc('admin_sponsorship_overview', { p_limit: 50 });
      if (error) {
        setSponsorshipOverview(null);
        setSponsorshipOverviewError(error.message || 'Falha ao carregar visão geral de patrocínios');
        setSponsorshipOverviewLoading(false);
        return;
      }
      setSponsorshipOverview(data || null);
      setSponsorshipOverviewLoading(false);
    };

    const refreshAdminUsers = async (search = adminSearch, preserveSelection = true) => {
      if (!isAdmin) return;
      setAdminLoading(true);
      setAdminError(null);
      const res = await loadAdminUsers(search);
      if (!res.ok) {
        setAdminUsers([]);
        setAdminError(res.error || 'Falha ao carregar usuários');
        setAdminLoading(false);
        return;
      }
      const items = Array.isArray(res.items) ? res.items : [];
      setAdminUsers(items);
      setAdminLoading(false);
      if (!preserveSelection || !selectedAdminUserId) {
        setSelectedAdminUserId(items[0]?.id || null);
        return;
      }
      if (!items.some((item) => item.id === selectedAdminUserId)) {
        setSelectedAdminUserId(items[0]?.id || null);
      }
    };

    useEffect(() => {
      if (!isAdmin) return;
      refreshAdminUsers('', false);
    }, []);

    const loadAdminGlobal = async () => {
      setAdminGlobalLoading(true);
      setAdminGlobalError(null);
      const { data, error } = await supabase.rpc('admin_global_summary');
      if (error) {
        setAdminGlobal(null);
        setAdminGlobalError(error.message || 'Falha ao carregar resumo');
        setAdminGlobalLoading(false);
        return;
      }
      setAdminGlobal(data || null);
      setAdminGlobalLoading(false);
    };

    useEffect(() => {
      if (!isAdmin) return;
      loadAdminGlobal();
    }, []);

    useEffect(() => {
      if (!isAdmin || !selectedAdminUserId) {
        setAdminDetail(null);
        return;
      }
      let cancelled = false;
      const run = async () => {
        setAdminDetailLoading(true);
        setAdminDetailError(null);
        const res = await loadAdminUserDetail(selectedAdminUserId);
        if (cancelled) return;
        if (!res.ok) {
          setAdminDetail(null);
          setAdminDetailError(res.error || 'Falha ao carregar detalhes do usuário');
          setAdminDetailLoading(false);
          return;
        }
        const detail = res.detail || null;
        setAdminDetail(detail);
        setAdminEdit({
          name: String(detail?.user?.name || ''),
          username: String(detail?.user?.username || ''),
          sponsor_code: String(detail?.user?.sponsor_username || detail?.user?.sponsor_code || ''),
          lang: String(detail?.user?.lang || 'pt')
        });
        setAdminBlockReason(String(detail?.user?.blocked_reason || ''));
        setSponsorshipLookup((prev) => prev || String(detail?.user?.username || detail?.user?.email || ''));
        setAdminDetailLoading(false);
      };
      run();
      return () => {
        cancelled = true;
      };
    }, [selectedAdminUserId]);

    useEffect(() => {
      if (!selectedAdminUserId) {
        setSponsorshipStatus(null);
        setSponsorshipStatusError(null);
        return;
      }
      loadSponsorshipStatus(selectedAdminUserId);
    }, [selectedAdminUserId]);

    useEffect(() => {
      if (adminTab !== 'usuarios') return;
      loadSponsorshipOverview();
      loadNowExceptions();
      loadSuspiciousDeposits();
    }, [adminTab]);

    useEffect(() => {
      setWalletPrelaunchUntil(walletGate?.prelaunch_until ? String(walletGate.prelaunch_until) : '');
      setWalletPrelaunchNote(walletGate?.note ? String(walletGate.note) : '');
    }, [walletGate?.prelaunch_until, walletGate?.note]);

    const handleAdminSaveUser = async () => {
      if (!selectedAdminUserId) return;
      try {
        setAdminActionLoading(true);
        const res = await adminUpdateUser({
          user_id: selectedAdminUserId,
          name: adminEdit.name,
          username: adminEdit.username,
          sponsor_code: adminEdit.sponsor_code,
          lang: adminEdit.lang
        });
        if (!res.ok) {
          triggerNotification('Admin', res.error || 'Falha ao salvar usuário', 'error');
          return;
        }
        triggerNotification('Admin', 'Usuário atualizado.', 'success');
        await refreshAdminUsers(adminSearch, true);
        const detailRes = await loadAdminUserDetail(selectedAdminUserId);
        if (detailRes.ok) setAdminDetail(detailRes.detail || null);
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handleAdminSendReset = async () => {
      if (!selectedAdminUserId) return;
      try {
        setAdminActionLoading(true);
        const res = await adminSendPasswordReset({
          user_id: selectedAdminUserId,
          redirect_to: `${window.location.origin}/?mode=recovery`
        });
        if (!res.ok) {
          triggerNotification('Admin', res.error || 'Falha ao enviar e-mail de recuperação', 'error');
          return;
        }
        triggerNotification('Admin', 'E-mail de redefinição enviado.', 'success');
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handleAdminToggleBlocked = async () => {
      if (!selectedAdminUserId) return;
      try {
        setAdminActionLoading(true);
        const blocked = !Boolean(adminDetail?.user?.is_blocked);
        const res = await adminSetUserBlocked({
          user_id: selectedAdminUserId,
          blocked,
          reason: blocked ? adminBlockReason : null
        });
        if (!res.ok) {
          triggerNotification('Admin', res.error || 'Falha ao alterar bloqueio', 'error');
          return;
        }
        triggerNotification('Admin', blocked ? 'Usuário bloqueado.' : 'Usuário desbloqueado.', 'success');
        await refreshAdminUsers(adminSearch, true);
        const detailRes = await loadAdminUserDetail(selectedAdminUserId);
        if (detailRes.ok) setAdminDetail(detailRes.detail || null);
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handleAdminDelete = async () => {
      if (!selectedAdminUserId) return;
      if (!window.confirm('Deseja deletar este usuário? Esta ação remove o acesso e os dados vinculados.')) return;
      try {
        setAdminActionLoading(true);
        const res = await adminDeleteUser({ user_id: selectedAdminUserId });
        if (!res.ok) {
          triggerNotification('Admin', res.error || 'Falha ao deletar usuário', 'error');
          return;
        }
        triggerNotification('Admin', 'Usuário deletado.', 'success');
        setAdminDetail(null);
        setSelectedAdminUserId(null);
        await refreshAdminUsers(adminSearch, false);
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handleGrantSponsorship = async () => {
      const fallbackLookup = String(adminDetail?.user?.username || adminDetail?.user?.email || '').trim();
      const lookup = String(sponsorshipLookup || fallbackLookup).trim();
      const amount = Number(sponsorshipAmount);
      if (!lookup) {
        triggerNotification('Admin', 'Informe username ou email do usuário.', 'error');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        triggerNotification('Admin', 'Informe um valor válido para o patrocínio.', 'error');
        return;
      }
      try {
        setAdminActionLoading(true);
        const { data, error } = await supabase.rpc('admin_grant_sponsorship', {
          p_user_lookup: lookup,
          p_amount: amount,
          p_asset: String(sponsorshipAsset || 'usdt').toLowerCase(),
          p_note: String(sponsorshipNote || '').trim() || null
        });
        if (error) {
          triggerNotification('Admin', error.message || 'Falha ao creditar patrocínio', 'error');
          return;
        }
        triggerNotification(
          'Admin',
          `Patrocínio creditado: $${toNumber(data?.amount).toFixed(2)} (${String(data?.asset || '').toUpperCase()})`,
          'success'
        );
        setSponsorshipAmount('');
        setSponsorshipNote('');
        await refreshAdminUsers(adminSearch, true);
        if (selectedAdminUserId) {
          const detailRes = await loadAdminUserDetail(selectedAdminUserId);
          if (detailRes.ok) setAdminDetail(detailRes.detail || null);
          await loadSponsorshipStatus(selectedAdminUserId);
        }
      } finally {
        setAdminActionLoading(false);
      }
    };

    const handleSetWalletPrelaunch = async (blocked) => {
      try {
        setWalletPrelaunchSaving(true);
        setWalletPrelaunchError(null);
        const { data, error } = await supabase.rpc('admin_set_wallet_prelaunch', {
          p_blocked: Boolean(blocked),
          p_prelaunch_until: walletPrelaunchUntil ? walletPrelaunchUntil : null,
          p_note: String(walletPrelaunchNote || '').trim() || null
        });
        if (error) {
          setWalletPrelaunchError(error.message || 'Falha ao atualizar maintenance');
          triggerNotification('Admin', error.message || 'Falha ao atualizar maintenance', 'error');
          return;
        }
        triggerNotification(
          'Admin',
          Boolean(data?.wallet_prelaunch_blocked) ? 'Wallet em MAINTENANCE.' : 'Wallet liberada.',
          'success'
        );
        await loadWalletGate();
      } finally {
        setWalletPrelaunchSaving(false);
      }
    };

    const handleNowPaymentsHealth = async () => {
      try {
        setNowHealthLoading(true);
        const res = await nowPaymentsHealth();
        if (!res.ok) {
          triggerNotification('NOWPayments', res.error || 'Falha no healthcheck', 'error');
          return;
        }
        const info = res.data || {};
        if (!info.has_api_key || !info.has_public_key) {
          triggerNotification('NOWPayments', 'Integração parcial: configure NOWPAYMENTS_API_KEY e NOWPAYMENTS_PUBLIC_KEY nos Secrets.', 'error');
          return;
        }
        triggerNotification('NOWPayments', 'Integração ativa e pronta para criar pagamentos.', 'success');
      } finally {
        setNowHealthLoading(false);
      }
    };

    const handleNowPaymentsIpnSelftest = async () => {
      const res = await nowPaymentsIpnSelftest();
      if (!res.ok) {
        triggerNotification('NOWPayments', res.error || 'Falha no selftest do IPN', 'error');
        return;
      }
      triggerNotification('NOWPayments', 'IPN Secret validado com sucesso (assinatura OK).', 'success');
    };

    const handleNowPaymentsSync = async () => {
      const raw = String(nowSyncValue || '').trim();
      if (!raw) {
        triggerNotification('NOWPayments', 'Informe um Payment ID ou Order ID.', 'error');
        return;
      }
      try {
        setNowSyncLoading(true);
        const isNumeric = /^\d+$/.test(raw);
        const res = await nowPaymentsSyncPayment({
          payment_id: isNumeric ? raw : null,
          order_id: isNumeric ? null : raw
        });
        if (!res.ok) {
          triggerNotification('NOWPayments', res.error || 'Falha ao sincronizar pagamento', 'error');
          return;
        }
        triggerNotification('NOWPayments', `Sincronizado. Status: ${String(res.data?.payment_status || '—')}`, 'success');
      } finally {
        setNowSyncLoading(false);
      }
    };

    const loadNowExceptions = async () => {
      setNowExceptionsLoading(true);
      const { data, error } = await supabase.rpc('admin_nowpayments_exceptions', { p_limit: 25 });
      if (!error) {
        setNowExceptions(Array.isArray(data?.items) ? data.items : []);
      }
      setNowExceptionsLoading(false);
    };

    const handleNowResolve = async (action) => {
      const orderId = String(nowResolveOrderId || '').trim();
      if (!orderId) {
        triggerNotification('NOWPayments', 'Informe o Order ID.', 'error');
        return;
      }
      try {
        setNowResolveLoading(true);
        const { data, error } = await supabase.rpc('admin_nowpayments_resolve', {
          p_order_id: orderId,
          p_action: String(action || ''),
          p_note: String(nowResolveNote || '').trim() || null
        });
        if (error) {
          triggerNotification('NOWPayments', error.message || 'Falha ao resolver', 'error');
          return;
        }
        triggerNotification('NOWPayments', `Resolvido: ${String(data?.action || action)}`, 'success');
        setNowResolveNote('');
        await loadNowExceptions();
      } finally {
        setNowResolveLoading(false);
      }
    };

    const handleDepositReverse = async ({ ledger_id, note } = {}) => {
      const ledgerId = String(ledger_id || depositReverseLedgerId || '').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ledgerId)) {
        triggerNotification('Estorno', 'Informe um ledger_id válido (UUID).', 'error');
        return;
      }
      try {
        setDepositReverseLoading(true);
        const noteRaw = note !== undefined ? note : depositReverseNote;
        const { data, error } = await supabase.rpc('admin_reverse_deposit', {
          p_ledger_id: ledgerId,
          p_note: String(noteRaw || '').trim() || null
        });
        if (error) {
          triggerNotification('Estorno', error.message || 'Falha ao estornar depósito', 'error');
          return;
        }
        if (data?.already_reversed) {
          triggerNotification('Estorno', `Já estornado. Reversal: ${String(data?.reversal_ledger_id || '—')}`, 'info');
        } else {
          triggerNotification('Estorno', `Estornado. Reversal: ${String(data?.reversal_ledger_id || '—')}`, 'success');
        }
        setDepositReverseLedgerId('');
        setDepositReverseNote('');
        if (selectedAdminUserId) {
          const detailRes = await loadAdminUserDetail(selectedAdminUserId);
          if (detailRes?.ok) setAdminDetail(detailRes.detail || null);
        }
      } finally {
        setDepositReverseLoading(false);
      }
    };

    const loadSuspiciousDeposits = async () => {
      setSuspiciousDepositsLoading(true);
      setSuspiciousDepositsError(null);
      const { data, error } = await supabase.rpc('admin_suspicious_deposits', { p_limit: 50 });
      if (error) {
        setSuspiciousDeposits([]);
        setSuspiciousDepositsError(error.message || 'Falha ao carregar depósitos suspeitos');
        setSuspiciousDepositsLoading(false);
        return;
      }
      setSuspiciousDeposits(Array.isArray(data?.items) ? data.items : []);
      setSuspiciousDepositsLoading(false);
    };

    const loadSupportInbox = async ({ search = supportSearch, status = supportStatus, preserveSelection = true } = {}) => {
      setSupportLoading(true);
      setSupportError(null);
      const searchText = String(search || '').trim() || null;
      const statusText = String(status || '').trim() || null;
      const { data, error } = await supabase.rpc('support_list_tickets_admin', {
        search_text: searchText,
        status: statusText,
        limit_rows: 60
      });
      if (error) {
        setSupportTickets([]);
        setSupportError(error.message || 'Falha ao carregar tickets');
        setSupportLoading(false);
        return;
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      setSupportTickets(items);
      setSupportLoading(false);
      if (!preserveSelection || !supportSelectedId) {
        setSupportSelectedId(items[0]?.id || null);
        return;
      }
      if (!items.some((item) => item.id === supportSelectedId)) {
        setSupportSelectedId(items[0]?.id || null);
      }
    };

    const loadSupportDepositOverview = async () => {
      setSupportDepositOverviewLoading(true);
      setSupportDepositOverviewError(null);
      const { data, error } = await supabase.rpc('admin_nowpayments_support_overview', { p_limit: 25 });
      if (error) {
        setSupportDepositOverview([]);
        setSupportDepositOverviewError(error.message || 'Falha ao carregar depósitos');
        setSupportDepositOverviewLoading(false);
        return;
      }
      setSupportDepositOverview(Array.isArray(data?.items) ? data.items : []);
      setSupportDepositOverviewLoading(false);
    };

    const handleSupportDepositSyncNow = async (row) => {
      const orderId = String(row?.order_id || '').trim();
      const paymentId = String(row?.payment_id || '').trim();
      const key = orderId || paymentId;
      if (!key) return;
      setSupportDepositSyncing(prev => ({ ...prev, [key]: true }));
      try {
        const res = await nowPaymentsSyncPayment({
          payment_id: paymentId ? paymentId : null,
          order_id: paymentId ? null : (orderId || null)
        });
        if (!res.ok) {
          triggerNotification('NOWPayments', res.error || 'Falha ao sincronizar pagamento', 'error');
          return;
        }
        triggerNotification('NOWPayments', `${t.adminNowSupportDepositsSynced || 'Sincronizado.'} Status: ${String(res.data?.payment_status || '—')}`, 'success');
        await loadSupportDepositOverview();
      } finally {
        setSupportDepositSyncing(prev => ({ ...prev, [key]: false }));
      }
    };

    const loadSupportThread = async (ticketId) => {
      const { data, error } = await supabase.rpc('support_get_ticket', { ticket_id: ticketId });
      if (error) return { ok: false, error: error.message || 'Falha ao abrir ticket' };
      return { ok: true, ticket: data?.ticket || null, messages: Array.isArray(data?.messages) ? data.messages : [] };
    };

    const loadSupportAttachments = async (ticketId) => {
      setSupportAttachmentsError(null);
      const { data, error } = await supabase.rpc('support_list_attachments', { ticket_id: ticketId });
      if (error) return { ok: false, error: error.message || 'Falha ao carregar anexos' };
      setSupportAttachments(Array.isArray(data?.items) ? data.items : []);
      return { ok: true };
    };

    const openSupportAttachment = async (att) => {
      const path = String(att?.storage_path || '').trim();
      if (!path) return;
      const { data, error } = await supabase.storage.from('support-proofs').createSignedUrl(path, 60 * 10);
      if (error || !data?.signedUrl) {
        triggerNotification(t.support, error?.message || 'Falha ao abrir anexo', 'error');
        return;
      }
      openExternalUrl(data.signedUrl, { title: t.support || 'Suporte' });
    };

    const openSupportTicket = async (ticketId) => {
      if (!ticketId) return;
      setSupportSelectedId(ticketId);
      setSupportThreadLoading(true);
      setSupportThreadError(null);
      setSupportAttachmentsError(null);
      const res = await loadSupportThread(ticketId);
      setSupportThreadLoading(false);
      if (!res.ok) {
        setSupportThread({ ticket: null, messages: [] });
        setSupportThreadError(res.error || 'Falha ao abrir ticket');
        return;
      }
      setSupportThread({ ticket: res.ticket, messages: res.messages });
      const attRes = await loadSupportAttachments(ticketId);
      if (!attRes.ok) setSupportAttachmentsError(attRes.error || 'Falha ao carregar anexos');
    };

    const loadAudit = async ({ table = auditTable, limit = auditLimit } = {}) => {
      setAuditLoading(true);
      setAuditError(null);
      const { data, error } = await supabase.rpc('admin_audit_list', {
        p_table_name: String(table || '').trim() || null,
        p_row_user_id: null,
        p_limit_rows: Math.max(10, Math.min(500, Number(limit) || 120))
      });
      if (error) {
        setAuditRows([]);
        setAuditError(error.message || 'Falha ao carregar auditoria');
        setAuditLoading(false);
        return;
      }
      setAuditRows(Array.isArray(data?.items) ? data.items : []);
      setAuditLoading(false);
    };

    const loadBotDailyReport = async ({ dayKey = botDailyDayKey, limit = botDailyLimit } = {}) => {
      setBotDailyLoading(true);
      setBotDailyError(null);
      setBotDailyAuditLoading(true);
      setBotDailyAuditError(null);
      const day = String(dayKey || '').trim();
      const limitRows = Math.max(10, Math.min(500, Number(limit) || 200));

      const [reportRes, auditRes] = await Promise.all([
        supabase.rpc('admin_bot_daily_report', { p_day_key: day ? day : null, p_limit_rows: limitRows }),
        supabase.rpc('admin_bot_daily_audit', { p_day_key: day ? day : null })
      ]);

      if (reportRes.error) {
        setBotDailyRows([]);
        setBotDailyError(reportRes.error.message || 'Falha ao carregar relatório do BOT');
      } else {
        setBotDailyRows(Array.isArray(reportRes.data?.items) ? reportRes.data.items : []);
      }
      setBotDailyLoading(false);

      if (auditRes.error) {
        setBotDailyAudit(null);
        setBotDailyAuditError(auditRes.error.message || 'Falha ao carregar auditoria do dia');
      } else {
        setBotDailyAudit(auditRes.data || null);
      }
      setBotDailyAuditLoading(false);
    };

    if (!isAdmin) {
      return (
        <div className="px-4 pb-24 pt-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setView('settings')} className="text-gray-400 hover:text-white"><ChevronRight className="rotate-180" /></button>
            <h2 className="text-2xl font-bold text-white">{t.adminPanel}</h2>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-gray-300">
            {t.adminRestricted}
          </div>
        </div>
      );
    }

    useEffect(() => {
      if (adminTab !== 'suporte') return;
      loadSupportDepositOverview();
      loadSupportInbox({ search: '', status: '', preserveSelection: false });
    }, [adminTab]);

    useEffect(() => {
      if (adminTab !== 'auditoria') return;
      loadAudit({ table: auditTable, limit: auditLimit });
    }, [adminTab]);

    useEffect(() => {
      if (adminTab !== 'bot_diario') return;
      loadBotDailyReport({ dayKey: botDailyDayKey, limit: botDailyLimit });
    }, [adminTab]);

    useEffect(() => {
      if (adminTab !== 'saques') return;
      loadWithdrawQueue({ search: withdrawQueueSearch, status: withdrawQueueStatus });
    }, [adminTab]);

    useEffect(() => {
      if (adminTab !== 'logs') return;
      loadAdminLogs();
    }, [adminTab]);

    useEffect(() => {
      if (adminTab !== 'suporte') return;
      if (!supportSelectedId) {
        setSupportThread({ ticket: null, messages: [] });
        setSupportThreadError(null);
        return;
      }
      let cancelled = false;
      const run = async () => {
        setSupportThreadLoading(true);
        setSupportThreadError(null);
        const res = await loadSupportThread(supportSelectedId);
        if (cancelled) return;
        setSupportThreadLoading(false);
        if (!res.ok) {
          setSupportThread({ ticket: null, messages: [] });
          setSupportThreadError(res.error || 'Falha ao abrir ticket');
          return;
        }
        setSupportThread({ ticket: res.ticket, messages: res.messages });
        const attRes = await loadSupportAttachments(supportSelectedId);
        if (!attRes.ok) setSupportAttachmentsError(attRes.error || 'Falha ao carregar anexos');
      };
      run();
      return () => { cancelled = true; };
    }, [adminTab, supportSelectedId]);

    return (
      <div className="px-4 pb-24 pt-4">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setView('settings')} className="text-gray-400 hover:text-white"><ChevronRight className="rotate-180" /></button>
          <h2 className="text-2xl font-bold text-white">{t.adminPanel}</h2>
        </div>

        <div className="bg-gray-800 p-5 rounded-xl border border-blue-900/60 mb-6">
          <div className="flex items-center justify-between gap-3 mb-4 border-b border-blue-900/40 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-400" />
              <h3 className="text-white font-bold">{t.adminAdministration}</h3>
            </div>
            <button
              onClick={() => setView('settings')}
              className="text-xs bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg"
            >
              {t.adminReturn}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setAdminTab('usuarios')}
              className={`text-xs px-3 py-2 rounded-lg border ${adminTab === 'usuarios' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
            >
              {t.adminTabUsers}
            </button>
            <button
              onClick={() => setAdminTab('relatorios')}
              className={`text-xs px-3 py-2 rounded-lg border ${adminTab === 'relatorios' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
            >
              {t.adminTabReports}
            </button>
            <button
              onClick={() => setAdminTab('rede')}
              className={`text-xs px-3 py-2 rounded-lg border ${adminTab === 'rede' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
            >
              {t.adminTabNetwork}
            </button>
            <button
              onClick={() => setAdminTab('suporte')}
              className={`text-xs px-3 py-2 rounded-lg border ${adminTab === 'suporte' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
            >
              {t.adminTabSupport}
            </button>
            {canWithdrawView ? (
              <button
                onClick={() => setAdminTab('saques')}
                className={`text-xs px-3 py-2 rounded-lg border ${adminTab === 'saques' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
              >
                {t.adminTabWithdraws}
              </button>
            ) : null}
            <button
              onClick={() => setAdminTab('bot_diario')}
              className={`text-xs px-3 py-2 rounded-lg border ${adminTab === 'bot_diario' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
            >
              {t.adminTabBotDaily}
            </button>
            <button
              onClick={() => setAdminTab('auditoria')}
              className={`text-xs px-3 py-2 rounded-lg border ${adminTab === 'auditoria' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
            >
              {t.adminTabAudit}
            </button>
            <button
              onClick={() => setAdminTab('logs')}
              className={`text-xs px-3 py-2 rounded-lg border ${adminTab === 'logs' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
            >
              {t.adminTabLogs}
            </button>
          </div>

          {adminTab === 'relatorios' && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-5">
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminEntryUsd}</p>
                  <p className="text-green-400 font-bold mt-1">${toNumber(adminGlobal?.entrada_usd).toFixed(2)}</p>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminExitUsd}</p>
                  <p className="text-red-400 font-bold mt-1">${toNumber(adminGlobal?.saida_usd).toFixed(2)}</p>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminApplyUsdAlpha}</p>
                  <p className="text-green-300 font-bold mt-1">${toNumber(adminGlobal?.aplicacao_alpha_usd).toFixed(2)}</p>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminApplyUsdBinary}</p>
                  <p className="text-green-300 font-bold mt-1">${toNumber(adminGlobal?.aplicacao_binary_usd).toFixed(2)}</p>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminVolumeVdt}</p>
                  <p className="text-yellow-300 font-bold mt-1">{toNumber(adminGlobal?.volume_vdt).toFixed(2)}</p>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminCommissionsUsd}</p>
                  <p className="text-blue-300 font-bold mt-1">${toNumber(adminGlobal?.comissoes_usd).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-[11px] text-gray-500">
                  {adminGlobalLoading ? t.adminGlobalLoading : (adminGlobalError ? adminGlobalError : t.adminGlobalSummary)}
                </div>
                <button
                  onClick={loadAdminGlobal}
                  disabled={adminGlobalLoading}
                  className="text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg"
                >
                  {t.adminUpdate}
                </button>
              </div>
            </>
          )}

          {adminTab === 'saques' ? (
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <div className="text-[10px] text-gray-500 mb-1">{t.adminWithdrawQueueTitle}</div>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={withdrawQueueSearch}
                    onChange={(e) => setWithdrawQueueSearch(e.target.value)}
                    placeholder={t.adminWithdrawQueueSearchPlaceholder}
                  />
                </div>
                <div className="w-full md:w-[220px]">
                  <div className="text-[10px] text-gray-500 mb-1">{t.filter}</div>
                  <select
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={withdrawQueueStatus}
                    onChange={(e) => setWithdrawQueueStatus(e.target.value)}
                  >
                    <option value="pending">{t.adminWithdrawQueueFilterPending}</option>
                    <option value="approved">{t.adminWithdrawQueueFilterApproved}</option>
                    <option value="rejected">{t.adminWithdrawQueueFilterRejected}</option>
                    <option value="all">{t.adminWithdrawQueueFilterAll}</option>
                  </select>
                </div>
                <div className="w-full md:w-[200px] flex items-end">
                  <label className="flex items-center gap-2 text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-lg px-3 py-3 w-full">
                    <input
                      type="checkbox"
                      className="accent-green-500"
                      checked={withdrawQueueRemember}
                      onChange={(e) => setWithdrawQueueRemember(Boolean(e.target.checked))}
                    />
                    {t.adminWithdrawQueueRemember}
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => loadWithdrawQueue({ search: withdrawQueueSearch, status: withdrawQueueStatus })}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg"
                >
                  {t.adminUpdate}
                </button>
              </div>

              {withdrawQueueError && <div className="text-xs text-red-400 mb-3">{withdrawQueueError}</div>}
              {withdrawQueueLoading && <div className="text-xs text-gray-400 mb-3">{t.adminLoading}</div>}

              <div className="space-y-2 max-h-[640px] overflow-y-auto">
                {(Array.isArray(withdrawQueueRows) ? withdrawQueueRows : []).map((row) => (
                  <div key={row.id} className="bg-gray-950/50 border border-gray-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-bold truncate">{row.email || row.username || row.user_id}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        @{row.username || t.noUsername} · {String(row.asset || '').toUpperCase()} {toNumber(row.amount).toFixed(4)} · {String(row.status || 'pending')}
                      </p>
                      {row?.meta?.address ? (
                        <p className="text-[10px] text-gray-600 truncate">
                          {String(row.meta.address)}
                        </p>
                      ) : null}
                      <p className="text-[10px] text-gray-600 truncate">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : ''} · {row.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canWithdrawManage ? (
                        <label className="flex items-center gap-2 text-[11px] text-gray-300">
                          <input
                            type="checkbox"
                            className="accent-yellow-400"
                            checked={Boolean(row.withdraw_auto_approve)}
                            onChange={async (e) => {
                              try {
                                setWithdrawQueueLoading(true);
                                const { error } = await supabase.rpc('admin_withdraw_auto_set', {
                                  target_user_id: row.user_id,
                                  enabled: Boolean(e.target.checked)
                                });
                                if (error) {
                                  triggerNotification('Admin', error.message || 'Falha ao atualizar auto', 'error');
                                  return;
                                }
                                await loadWithdrawQueue({ search: withdrawQueueSearch, status: withdrawQueueStatus });
                              } finally {
                                setWithdrawQueueLoading(false);
                              }
                            }}
                          />
                          {t.adminWithdrawQueueAuto}
                        </label>
                      ) : null}
                      {canWithdrawApprove ? (
                        <>
                          <button
                            type="button"
                            disabled={withdrawQueueLoading || String(row.status || '').toLowerCase() === 'approved'}
                            onClick={async () => {
                              try {
                                setWithdrawQueueLoading(true);
                                const { error } = await supabase.rpc('admin_withdraw_approve', {
                                  withdraw_ledger_id: row.id,
                                  remember_user: Boolean(withdrawQueueRemember)
                                });
                                if (error) {
                                  triggerNotification('Admin', error.message || 'Falha ao aprovar', 'error');
                                  return;
                                }
                                triggerNotification('Admin', t.adminWithdrawApproved, 'success');
                                await loadWithdrawQueue({ search: withdrawQueueSearch, status: withdrawQueueStatus });
                              } finally {
                                setWithdrawQueueLoading(false);
                              }
                            }}
                            className="bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                          >
                            {t.adminWithdrawQueueApprove}
                          </button>
                          <button
                            type="button"
                            disabled={withdrawQueueLoading || ['approved','rejected'].includes(String(row.status || '').toLowerCase())}
                            onClick={async () => {
                              const reason = window.prompt(t.adminWithdrawQueueRejectReason, '') ?? '';
                              try {
                                setWithdrawQueueLoading(true);
                                const { error } = await supabase.rpc('admin_withdraw_reject', {
                                  withdraw_ledger_id: row.id,
                                  reason: String(reason || '').trim() || null,
                                  refund: true
                                });
                                if (error) {
                                  triggerNotification('Admin', error.message || 'Falha ao rejeitar', 'error');
                                  return;
                                }
                                triggerNotification('Admin', t.adminWithdrawQueueReject, 'success');
                                await loadWithdrawQueue({ search: withdrawQueueSearch, status: withdrawQueueStatus });
                              } finally {
                                setWithdrawQueueLoading(false);
                              }
                            }}
                            className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                          >
                            {t.adminWithdrawQueueReject}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!withdrawQueueLoading && (!Array.isArray(withdrawQueueRows) || !withdrawQueueRows.length) ? (
                  <div className="text-xs text-gray-500">{t.adminWithdrawQueueEmpty}</div>
                ) : null}
              </div>
            </div>
          ) : adminTab === 'logs' ? (
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <div className="text-[10px] text-gray-500 mb-1">{t.adminLogsTitle}</div>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={adminLogsSearch}
                    onChange={(e) => setAdminLogsSearch(e.target.value)}
                    placeholder={t.adminLogsSearchPlaceholder}
                  />
                </div>
                <div className="w-full md:w-[260px]">
                  <div className="text-[10px] text-gray-500 mb-1">{t.filter}</div>
                  <select
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={adminLogsAction}
                    onChange={(e) => setAdminLogsAction(e.target.value)}
                  >
                    <option value="">{t.adminLogsActionAll}</option>
                    <option value="withdraw_approve">withdraw_approve</option>
                    <option value="withdraw_reject">withdraw_reject</option>
                    <option value="withdraw_auto_set">withdraw_auto_set</option>
                    <option value="sponsorship_grant">sponsorship_grant</option>
                    <option value="update_user">update_user</option>
                    <option value="send_password_reset">send_password_reset</option>
                    <option value="block_user">block_user</option>
                    <option value="unblock_user">unblock_user</option>
                    <option value="delete_user">delete_user</option>
                  </select>
                </div>
                <div className="w-full md:w-[160px]">
                  <div className="text-[10px] text-gray-500 mb-1">{t.adminLogsFrom}</div>
                  <input
                    type="date"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={adminLogsFromDay}
                    onChange={(e) => setAdminLogsFromDay(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-[160px]">
                  <div className="text-[10px] text-gray-500 mb-1">{t.adminLogsTo}</div>
                  <input
                    type="date"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={adminLogsToDay}
                    onChange={(e) => setAdminLogsToDay(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={loadAdminLogs}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg"
                >
                  {t.adminUpdate}
                </button>
              </div>

              {adminLogsError && <div className="text-xs text-red-400 mb-3">{adminLogsError}</div>}
              {adminLogsLoading && <div className="text-xs text-gray-400 mb-3">{t.adminLoading}</div>}

              <div className="space-y-2 max-h-[640px] overflow-y-auto">
                {(Array.isArray(adminLogsRows) ? adminLogsRows : []).map((row) => (
                  <details key={row.id} className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                    <summary className="cursor-pointer select-none flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm text-white font-bold truncate">{row.action}</div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {row.actor_email || '—'} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                        </div>
                        <div className="text-[10px] text-gray-600 truncate">
                          {row.target_user_id ? `user: ${row.target_user_id}` : ''}{row.target_ledger_id ? ` · ledger: ${row.target_ledger_id}` : ''}
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">{row.id}</div>
                    </summary>
                    <div className="mt-3 bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t.adminLogsMeta}</div>
                      <pre className="text-[11px] text-gray-200 whitespace-pre-wrap break-words">{JSON.stringify(row.meta || {}, null, 2)}</pre>
                    </div>
                  </details>
                ))}
                {!adminLogsLoading && (!Array.isArray(adminLogsRows) || !adminLogsRows.length) ? (
                  <div className="text-xs text-gray-500">{t.adminLogsEmpty}</div>
                ) : null}
              </div>
            </div>
          ) : adminTab === 'bot_diario' ? (
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <div className="text-[10px] text-gray-500 mb-1">{t.adminBotDailyDayHint}</div>
                  <input
                    type="date"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={botDailyDayKey}
                    onChange={(e) => setBotDailyDayKey(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-[160px]">
                  <div className="text-[10px] text-gray-500 mb-1">{t.adminLimit}</div>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={botDailyLimit}
                    onChange={(e) => setBotDailyLimit(Number(e.target.value) || 200)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadBotDailyReport({ dayKey: botDailyDayKey, limit: botDailyLimit })}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg"
                >
                  {t.adminUpdate}
                </button>
              </div>

              {botDailyError && <div className="text-xs text-red-400 mb-3">{botDailyError}</div>}
              {botDailyLoading && <div className="text-xs text-gray-400 mb-3">{t.adminBotDailyLoading}</div>}
              {botDailyAuditError && <div className="text-xs text-red-400 mb-3">{botDailyAuditError}</div>}
              {botDailyAuditLoading && <div className="text-xs text-gray-400 mb-3">{t.adminBotDailyAuditLoading}</div>}

              {(() => {
                const toNum = (v) => {
                  const n = Number(v);
                  return Number.isFinite(n) ? n : 0;
                };

                const rows = Array.isArray(botDailyRows) ? botDailyRows : [];
                const creditsTotal = toNum(botDailyAudit?.credits?.total);
                const creditsContracts = toNum(botDailyAudit?.credits?.contracts);
                const creditsUsers = toNum(botDailyAudit?.credits?.users);
                const residualTotal = toNum(botDailyAudit?.residual?.total);
                const residualRows = toNum(botDailyAudit?.residual?.rows);
                const residualUsers = toNum(botDailyAudit?.residual?.users);
                const totals = rows.reduce((acc, r) => {
                  const amount = toNum(r.amount);
                  const target = toNum(r.daily_target_profit);
                  const applied = toNum(r.daily_profit_applied);
                  const status = String(r.daily_state_status || '');
                  acc.capital += amount;
                  acc.target += target;
                  acc.applied += applied;
                  if (status === 'done') acc.done += 1;
                  else if (status === 'running') acc.running += 1;
                  else if (status === 'pending') acc.pending += 1;
                  else acc.other += 1;
                  return acc;
                }, { capital: 0, target: 0, applied: 0, done: 0, running: 0, pending: 0, other: 0 });

                const pct = totals.capital > 0 ? (totals.applied / totals.capital) * 100 : 0;

                return (
                  <>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminBotDailyCreditsCard}</p>
                        <p className="text-green-300 font-bold mt-1">${creditsTotal.toFixed(4)}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {t.adminBotDailyContracts}: <span className="text-gray-200 font-mono">{creditsContracts}</span> · {t.adminBotDailyUsers}: <span className="text-gray-200 font-mono">{creditsUsers}</span>
                        </p>
                      </div>
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminBotDailyResidualCard}</p>
                        <p className="text-blue-300 font-bold mt-1">${residualTotal.toFixed(4)}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {t.adminBotDailyEntries}: <span className="text-gray-200 font-mono">{residualRows}</span> · {t.adminBotDailyUsers}: <span className="text-gray-200 font-mono">{residualUsers}</span>
                        </p>
                      </div>
                      <div className="hidden xl:block bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminBotDailyNetCard}</p>
                        <p className="text-gray-100 font-bold mt-1">${(creditsTotal - residualTotal).toFixed(4)}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{t.adminBotDailyNetHint}</p>
                      </div>
                      <div className="hidden xl:block bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminBotDailyDayKeyCard}</p>
                        <p className="text-gray-100 font-bold mt-1">{String(botDailyAudit?.day_key || botDailyDayKey || '—')}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{t.adminBotDailyWashingtonHint}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-4">
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminCapitalUsd}</p>
                        <p className="text-gray-100 font-bold mt-1">${totals.capital.toFixed(2)}</p>
                      </div>
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminTargetUsd}</p>
                        <p className="text-yellow-300 font-bold mt-1">${totals.target.toFixed(4)}</p>
                      </div>
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminAppliedUsd}</p>
                        <p className="text-green-300 font-bold mt-1">${totals.applied.toFixed(4)}</p>
                      </div>
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminYieldPct}</p>
                        <p className="text-green-400 font-bold mt-1">{pct.toFixed(2)}%</p>
                      </div>
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminDone}</p>
                        <p className="text-green-400 font-bold mt-1">{totals.done}</p>
                      </div>
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminRunning}</p>
                        <p className="text-blue-300 font-bold mt-1">{totals.running + totals.pending + totals.other}</p>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[640px] overflow-y-auto">
                      {rows.map((r) => {
                        const cyclesTotal = toNum(r.cycles_total);
                        const cyclesDone = Math.min(toNum(r.daily_cycle_index), cyclesTotal || 0);
                        const amount = toNum(r.amount);
                        const applied = toNum(r.daily_profit_applied);
                        const target = toNum(r.daily_target_profit);
                        const status = String(r.daily_state_status || '');
                        const hit = status === 'done' || (target > 0 && applied >= (target - 0.0001));
                        const rowPct = amount > 0 ? (applied / amount) * 100 : 0;
                        return (
                          <div key={r.contract_id} className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm text-white font-bold truncate">
                                  {r.email || '—'} {r.username ? `(@${r.username})` : ''}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {t.adminPlan} {r.plan_id} · {t.adminContract} {String(r.contract_id).slice(0, 8)}… · {t.adminStatus} {status}
                                </div>
                              </div>
                              <div className={`text-[10px] px-2 py-1 rounded border ${hit ? 'text-green-300 border-green-700 bg-green-900/20' : 'text-yellow-200 border-yellow-700 bg-yellow-900/20'}`}>
                                {hit ? t.adminBotTargetHit : t.adminBotInProgress}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px]">
                              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-2">
                                <div className="text-gray-500">{t.adminCapital}</div>
                                <div className="text-gray-100 font-mono">${amount.toFixed(2)}</div>
                              </div>
                              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-2">
                                <div className="text-gray-500">{t.adminApplied}</div>
                                <div className="text-green-300 font-mono">${applied.toFixed(4)} ({rowPct.toFixed(2)}%)</div>
                              </div>
                              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-2">
                                <div className="text-gray-500">{t.adminTarget}</div>
                                <div className="text-yellow-300 font-mono">${target.toFixed(4)}</div>
                              </div>
                              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-2">
                                <div className="text-gray-500">{t.adminCycles}</div>
                                <div className="text-gray-100 font-mono">{cyclesDone}/{cyclesTotal}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {!botDailyLoading && !rows.length && (
                        <div className="text-xs text-gray-500">{t.adminContractsNoneForDay}</div>
                      )}
                    </div>

                  </>
                );
              })()}
            </div>
          ) : adminTab === 'suporte' ? (
            <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-4">
              <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-yellow-300 font-bold tracking-wide">{t.adminNowSupportDepositsTitle || 'DEPÓSITOS · SUPORTE ABERTO'}</p>
                      <p className="text-[11px] text-gray-500 mt-1">{t.adminNowSupportDepositsHint || 'Triagem rápida de depósitos com chamado aberto.'}</p>
                    </div>
                    <button
                      onClick={loadSupportDepositOverview}
                      className="shrink-0 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg text-xs"
                    >
                      {t.adminUpdate || 'Atualizar'}
                    </button>
                  </div>
                  {supportDepositOverviewError && <div className="text-xs text-red-400 mt-2">{supportDepositOverviewError}</div>}
                  {supportDepositOverviewLoading ? (
                    <div className="text-xs text-gray-500 mt-2">{t.adminLoading}</div>
                  ) : (
                    <div className="mt-2 space-y-2 max-h-[180px] overflow-y-auto">
                      {(Array.isArray(supportDepositOverview) ? supportDepositOverview : []).map((row) => (
                        <div key={row.order_id} className="bg-gray-900/40 border border-gray-800 rounded-lg p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs text-white font-bold truncate">
                                {String(row.email || '—')} {row.username ? `(@${row.username})` : ''}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate">
                                Order {String(row.order_id || '').slice(0, 18)}{String(row.order_id || '').length > 18 ? '…' : ''} · {String(row.payment_status || '—')}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                ${Number(row.price_amount || 0).toFixed(2)} {String(row.deposit_asset || '').toUpperCase()}
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col gap-2">
                              <button
                                onClick={() => handleSupportDepositSyncNow(row)}
                                disabled={Boolean(supportDepositSyncing[String(row.order_id || row.payment_id || '')])}
                                className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold px-3 py-2 rounded-lg text-xs"
                              >
                                {Boolean(supportDepositSyncing[String(row.order_id || row.payment_id || '')])
                                  ? (t.adminNowSupportDepositsSyncing || 'Sincronizando...')
                                  : (t.adminNowSupportDepositsSyncNow || 'Sincronizar agora')}
                              </button>
                              <button
                                onClick={() => openSupportTicket(row.support_ticket_id)}
                                className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-3 py-2 rounded-lg text-xs"
                              >
                                {t.adminNowSupportDepositsOpenTicket || 'Abrir ticket'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!Array.isArray(supportDepositOverview) || supportDepositOverview.length === 0) && (
                        <div className="text-xs text-gray-500">{t.adminNowSupportDepositsEmpty || 'Nenhum depósito com suporte aberto.'}</div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">{t.adminInboxAdmin}</p>
                <div className="space-y-2 mb-3">
                  <input
                    type="text"
                    placeholder={t.adminSearchTicketPlaceholder}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                    value={supportSearch}
                    onChange={(e) => setSupportSearch(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <select
                      className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                      value={supportStatus}
                      onChange={(e) => setSupportStatus(e.target.value)}
                    >
                      <option value="">{t.adminAll}</option>
                      <option value="open">{t.statusOpen}</option>
                      <option value="in_progress">{t.statusInProgress}</option>
                      <option value="resolved">{t.statusResolved}</option>
                      <option value="closed">{t.statusClosed}</option>
                    </select>
                    <button
                      onClick={() => loadSupportInbox({ preserveSelection: false })}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg"
                    >
                      {t.adminSearch}
                    </button>
                  </div>
                </div>
                {supportError && <div className="text-xs text-red-400 mb-2">{supportError}</div>}
                <div className="space-y-2 max-h-[520px] overflow-y-auto">
                  {supportTickets.map((tkt) => (
                    (() => {
                      const st = String(tkt.status || '').toLowerCase();
                      const statusLabel =
                        st === 'open' ? (t.statusOpen || 'open') :
                        st === 'in_progress' ? (t.statusInProgress || 'in_progress') :
                        st === 'resolved' ? (t.statusResolved || 'resolved') :
                        st === 'closed' ? (t.statusClosed || 'closed') :
                        (tkt.status || '');
                      const statusClass =
                        st === 'open' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' :
                        st === 'in_progress' ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' :
                        st === 'resolved' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                        st === 'closed' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                        'bg-gray-500/10 border-gray-500/30 text-gray-300';
                      const lastSender = String(tkt.last_sender_role || '').toLowerCase();
                      const needsReply = (st === 'open' || st === 'in_progress') && (lastSender === 'user' || !lastSender);
                      return (
                    <button
                      key={tkt.id}
                      onClick={() => openSupportTicket(tkt.id)}
                      className={`w-full text-left rounded-lg border p-3 transition ${
                        supportSelectedId === tkt.id
                          ? 'bg-blue-900/20 border-blue-500'
                          : 'bg-gray-950/50 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {needsReply && (
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                              </span>
                            )}
                            <p className="text-sm text-white font-bold truncate">{tkt.subject}</p>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate">{tkt.email || tkt.username || ''}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] px-2 py-1 rounded-full border ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex justify-end text-[11px] text-gray-500 mt-1">
                        <span>{tkt.last_message_at ? new Date(tkt.last_message_at).toLocaleString() : ''}</span>
                      </div>
                    </button>
                      );
                    })()
                  ))}
                  {!supportLoading && !supportTickets.length && (
                    <div className="text-xs text-gray-500">{t.adminNoTickets}</div>
                  )}
                  {supportLoading && <div className="text-xs text-gray-500">{t.adminLoading}</div>}
                </div>
              </div>

              <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
                {supportThreadLoading ? (
                  <div className="text-sm text-gray-500">{t.adminLoading}</div>
                ) : supportThreadError ? (
                  <div className="text-sm text-red-300">{supportThreadError}</div>
                ) : !supportThread.ticket ? (
                  <div className="text-sm text-gray-500">{t.adminSelectTicketInList}</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-lg text-white font-bold truncate">{supportThread.ticket.subject}</h4>
                        <p className="text-[11px] text-gray-500 truncate">
                          {supportThread.ticket.email || ''} {supportThread.ticket.username ? `(@${supportThread.ticket.username})` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const st = String(supportThread.ticket.status || '').toLowerCase();
                          const statusLabel =
                            st === 'open' ? (t.statusOpen || 'open') :
                            st === 'in_progress' ? (t.statusInProgress || 'in_progress') :
                            st === 'resolved' ? (t.statusResolved || 'resolved') :
                            st === 'closed' ? (t.statusClosed || 'closed') :
                            (supportThread.ticket.status || '');
                          const statusClass =
                            st === 'open' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' :
                            st === 'in_progress' ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' :
                            st === 'resolved' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                            st === 'closed' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                            'bg-gray-500/10 border-gray-500/30 text-gray-300';
                          return (
                            <span className={`text-xs px-3 py-2 rounded-lg border ${statusClass}`}>
                              {statusLabel}
                            </span>
                          );
                        })()}
                        <select
                          value={supportThread.ticket.status || 'open'}
                          onChange={async (e) => {
                            try {
                              setSupportStatusSaving(true);
                              const nextStatus = e.target.value;
                              const { error } = await supabase.rpc('support_set_status', { ticket_id: supportThread.ticket.id, new_status: nextStatus });
                              if (error) {
                                triggerNotification(t.support, error.message || t.adminUpdateStatusFail, 'error');
                                return;
                              }
                              const res = await loadSupportThread(supportThread.ticket.id);
                              if (res.ok) setSupportThread({ ticket: res.ticket, messages: res.messages });
                              await loadSupportInbox({ preserveSelection: true });
                              triggerNotification(t.support, t.adminStatusUpdated, 'success');
                            } finally {
                              setSupportStatusSaving(false);
                            }
                          }}
                          disabled={supportStatusSaving}
                          className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-white"
                        >
                          <option value="open">{t.statusOpen}</option>
                          <option value="in_progress">{t.statusInProgress}</option>
                          <option value="resolved">{t.statusResolved}</option>
                          <option value="closed">{t.statusClosed}</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                      {supportThread.messages.map((m) => (
                        <div key={m.id} className={`p-3 rounded-lg border ${m.sender_role === 'admin' ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-950/50 border-gray-800'}`}>
                          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                            <span>{m.sender_role}</span>
                            <span>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
                          </div>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap">{m.body}</p>
                          {(Array.isArray(supportAttachments) ? supportAttachments : []).some(a => a.message_id === m.id) && (
                            <div className="mt-2 space-y-1">
                              {(Array.isArray(supportAttachments) ? supportAttachments : [])
                                .filter(a => a.message_id === m.id)
                                .map((a) => (
                                  <button
                                    key={a.id}
                                    onClick={() => openSupportAttachment(a)}
                                    className="text-xs text-blue-300 hover:text-blue-200 underline break-all text-left"
                                  >
                                    {a.original_name || a.storage_path}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {!supportThread.messages.length && <div className="text-xs text-gray-500">{t.adminNoMessages}</div>}
                      {supportAttachmentsError && <div className="text-xs text-red-400">{supportAttachmentsError}</div>}
                    </div>

                    <div>
                      <textarea
                        placeholder={t.adminReplyAsAdmin}
                        className="w-full min-h-[90px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none mb-2"
                        value={supportReply}
                        onChange={(e) => setSupportReply(e.target.value)}
                      />
                      <button
                        onClick={async () => {
                          if (!supportThread.ticket?.id || !supportReply.trim()) return;
                          const ticketId = supportThread.ticket.id;
                          const message = supportReply.trim();
                          const { error } = await supabase.rpc('support_add_message', { ticket_id: ticketId, body: message });
                          if (error) {
                            triggerNotification(t.support, error.message || t.adminSendMessageFail, 'error');
                            return;
                          }
                          setSupportReply('');
                          const res = await loadSupportThread(ticketId);
                          if (res.ok) setSupportThread({ ticket: res.ticket, messages: res.messages });
                          await loadSupportInbox({ preserveSelection: true });
                          triggerNotification(t.support, t.adminMessageSent, 'success');
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg"
                      >
                        {t.adminSend}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : adminTab === 'auditoria' ? (
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <select
                  className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                  value={auditTable}
                  onChange={(e) => setAuditTable(e.target.value)}
                >
                  <option value="">{t.adminAuditAllTables}</option>
                  <option value="wallet_ledger">wallet_ledger</option>
                  <option value="plan_contracts">plan_contracts</option>
                </select>
                <input
                  type="number"
                  min="10"
                  max="500"
                  className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                  value={auditLimit}
                  onChange={(e) => setAuditLimit(Number(e.target.value) || 120)}
                />
                <button
                  onClick={() => loadAudit({ table: auditTable, limit: auditLimit })}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg"
                >
                  {t.adminAuditUpdate}
                </button>
              </div>
              {auditError && <div className="text-xs text-red-400 mb-3">{auditError}</div>}
              {auditLoading && <div className="text-xs text-gray-400 mb-3">{t.adminAuditLoading}</div>}
              <div className="space-y-2 max-h-[640px] overflow-y-auto">
                {auditRows.map((row) => (
                  <div key={row.id} className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                    <div className="flex flex-wrap gap-2 justify-between">
                      <div className="text-xs text-gray-400">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {row.table_name}.{row.action} {row.row_pk ? `#${row.row_pk}` : ''}
                      </div>
                    </div>
                    {row.summary && <div className="text-sm text-white mt-1">{row.summary}</div>}
                    <div className="text-[11px] text-gray-500 mt-1 break-all">
                      row_user_id: {row.row_user_id || '—'} · actor_auth_uid: {row.actor_auth_uid || '—'}
                    </div>
                  </div>
                ))}
                {!auditLoading && !auditRows.length && (
                  <div className="text-xs text-gray-500">{t.adminAuditNoEvents}</div>
                )}
              </div>
            </div>
          ) : (
            <>
              {adminTab === 'usuarios' && (
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs text-cyan-300 font-bold tracking-wide">MAINTENANCE · CONTROLE DA WALLET</p>
                      <p className="text-[11px] text-gray-500">
                        Status atual: {walletGateLoading ? 'carregando...' : (walletGate?.wallet_prelaunch_blocked ? 'BLOQUEADA' : 'LIBERADA')}
                      </p>
                    </div>
                    <button
                      onClick={loadWalletGate}
                      disabled={walletGateLoading}
                      className="text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg"
                    >
                      {t.adminUpdate}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <input
                      type="date"
                      className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                      value={walletPrelaunchUntil}
                      onChange={(e) => setWalletPrelaunchUntil(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Observação"
                      className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                      value={walletPrelaunchNote}
                      onChange={(e) => setWalletPrelaunchNote(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={() => handleSetWalletPrelaunch(true)}
                      disabled={walletPrelaunchSaving}
                      className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                    >
                      Bloquear Wallet (MAINTENANCE)
                    </button>
                    <button
                      onClick={() => handleSetWalletPrelaunch(false)}
                      disabled={walletPrelaunchSaving}
                      className="bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                    >
                      Liberar Wallet
                    </button>
                    <button
                      onClick={handleNowPaymentsHealth}
                      disabled={nowHealthLoading}
                      className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                    >
                      Testar NOWPayments
                    </button>
                    <button
                      onClick={handleNowPaymentsIpnSelftest}
                      className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-lg text-xs"
                    >
                      Testar IPN Secret
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Payment ID ou Order ID"
                      className="sm:col-span-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                      value={nowSyncValue}
                      onChange={(e) => setNowSyncValue(e.target.value)}
                    />
                    <button
                      onClick={handleNowPaymentsSync}
                      disabled={nowSyncLoading}
                      className="bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                    >
                      Sincronizar Pagamento
                    </button>
                  </div>

                  <div className="mt-3 bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs text-yellow-300 font-bold tracking-wide">EXCEÇÕES NOWPAYMENTS</p>
                      <button
                        onClick={loadNowExceptions}
                        disabled={nowExceptionsLoading}
                        className="text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg"
                      >
                        {t.adminUpdate}
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {(Array.isArray(nowExceptions) ? nowExceptions : []).map((row) => (
                        <button
                          key={row.id}
                          onClick={() => setNowResolveOrderId(String(row.order_id || ''))}
                          className="w-full text-left bg-gray-900/50 border border-gray-800 hover:border-gray-700 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-white font-bold truncate">{row.exception_status || 'exception'}</p>
                              <p className="text-[11px] text-gray-500 break-all">{row.order_id}</p>
                              <p className="text-[11px] text-gray-500">
                                {String(row.pay_currency || '').toUpperCase()} · ${toNumber(row.price_amount).toFixed(2)} · {String(row.payment_status || '').toUpperCase()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-gray-500">Payment</p>
                              <p className="text-[11px] text-gray-300 font-mono">{row.payment_id || '—'}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                      {!nowExceptionsLoading && (!(Array.isArray(nowExceptions) && nowExceptions.length)) ? (
                        <div className="text-xs text-gray-500">Nenhuma exceção pendente.</div>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Order ID para resolver"
                        className="sm:col-span-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                        value={nowResolveOrderId}
                        onChange={(e) => setNowResolveOrderId(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Nota (opcional)"
                        className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                        value={nowResolveNote}
                        onChange={(e) => setNowResolveNote(e.target.value)}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleNowResolve('credit_anyway')}
                        disabled={nowResolveLoading}
                        className="bg-yellow-700 hover:bg-yellow-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                      >
                        Creditar Mesmo Assim
                      </button>
                      <button
                        onClick={() => handleNowResolve('reject')}
                        disabled={nowResolveLoading}
                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                      >
                        Marcar como Resolvido
                      </button>
                    </div>
                  </div>

                  {canWithdrawManage && (
                    <div className="mt-3 bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                      <p className="text-xs text-red-300 font-bold tracking-wide">ESTORNAR DEPÓSITO (LEDGER)</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Use apenas para depósitos indevidos (sem NOWPayments). Gera um lançamento deposit_reversal e ajusta o saldo.
                      </p>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="ledger_id (UUID)"
                          className="sm:col-span-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                          value={depositReverseLedgerId}
                          onChange={(e) => setDepositReverseLedgerId(e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Nota (opcional)"
                          className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                          value={depositReverseNote}
                          onChange={(e) => setDepositReverseNote(e.target.value)}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={handleDepositReverse}
                          disabled={depositReverseLoading}
                          className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                        >
                          {depositReverseLoading ? 'Estornando...' : 'Estornar depósito'}
                        </button>
                      </div>
                    </div>
                  )}

                  {canWithdrawManage && (
                    <div className="mt-3 bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-xs text-red-300 font-bold tracking-wide">DEPÓSITOS SUSPEITOS RECENTES</p>
                        <button
                          onClick={loadSuspiciousDeposits}
                          disabled={suspiciousDepositsLoading}
                          className="text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg"
                        >
                          {t.adminUpdate}
                        </button>
                      </div>
                      {suspiciousDepositsError && <div className="text-xs text-red-400 mb-2">{suspiciousDepositsError}</div>}
                      {suspiciousDepositsLoading ? (
                        <div className="text-xs text-gray-500">Carregando...</div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                          {(Array.isArray(suspiciousDeposits) ? suspiciousDeposits : []).map((row) => (
                            <div key={row.ledger_id} className="bg-gray-900/40 border border-gray-800 rounded-lg p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs text-white font-bold truncate">
                                    {String(row.email || '—')} {row.username ? `(@${row.username})` : ''}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    {String(row.asset || '').toUpperCase()} {Number(row.amount || 0).toFixed(4)} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                                  </div>
                                  <div className="text-[11px] text-gray-500 break-all">
                                    ledger {String(row.ledger_id || '')}
                                  </div>
                                </div>
                                <div className="shrink-0 flex flex-col gap-2">
                                  <button
                                    onClick={async () => {
                                      await Promise.resolve(handleDepositReverse({
                                        ledger_id: String(row.ledger_id || ''),
                                        note: 'Estorno depósito suspeito (sem NOWPayments)'
                                      }));
                                      await Promise.resolve(loadSuspiciousDeposits());
                                    }}
                                    disabled={depositReverseLoading}
                                    className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-bold px-3 py-2 rounded-lg text-xs"
                                  >
                                    Estornar
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!Array.isArray(suspiciousDeposits) || suspiciousDeposits.length === 0) && (
                            <div className="text-xs text-gray-500">Nenhum depósito suspeito pendente.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {walletPrelaunchError ? (
                    <div className="text-[11px] text-red-400">{walletPrelaunchError}</div>
                  ) : null}
                </div>
              )}

              {adminTab === 'usuarios' && (
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs text-yellow-300 font-bold tracking-wide">PATROCINIOS BLOQUEANDO UNILEVEL</p>
                      <p className="text-[11px] text-gray-500">
                        {sponsorshipOverviewLoading ? 'Carregando...' : (sponsorshipOverviewError ? sponsorshipOverviewError : 'Visão geral operacional')}
                      </p>
                    </div>
                    <button
                      onClick={loadSponsorshipOverview}
                      disabled={sponsorshipOverviewLoading}
                      className="text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg"
                    >
                      {t.adminUpdate}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">Usuários com patrocínio</p>
                      <p className="text-white font-bold mt-1">{Number(sponsorshipOverview?.total_users || 0)}</p>
                    </div>
                    <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">Bloqueando unilevel</p>
                      <p className="text-red-300 font-bold mt-1">{Number(sponsorshipOverview?.blocked_users || 0)}</p>
                    </div>
                    <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">Restante total</p>
                      <p className="text-yellow-300 font-bold mt-1">${toNumber(sponsorshipOverview?.remaining_total).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {(Array.isArray(sponsorshipOverview?.items) ? sponsorshipOverview.items : []).map((row) => (
                      <button
                        key={row.user_id}
                        onClick={() => setSelectedAdminUserId(row.user_id)}
                        className="w-full text-left bg-gray-950/40 border border-gray-800 hover:border-gray-700 rounded-lg p-3 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-white font-bold truncate">{row.name || row.username || row.email}</p>
                            <p className="text-[11px] text-gray-500 truncate">@{row.username || t.noUsername} · {row.email || '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-gray-400">Restante</p>
                            <p className="text-yellow-300 font-mono font-bold">${toNumber(row.remaining_total).toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">{toNumber(row.percent_total).toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-500 to-green-400 transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, toNumber(row.percent_total)))}%` }}
                          />
                        </div>
                      </button>
                    ))}
                    {!sponsorshipOverviewLoading && (!Array.isArray(sponsorshipOverview?.items) || !sponsorshipOverview.items.length) ? (
                      <div className="text-xs text-gray-500">Nenhum usuário com unilevel bloqueado por patrocínio.</div>
                    ) : null}
                  </div>
                </div>
              )}
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <input
                  type="text"
                  placeholder={t.adminSearchPlaceholder}
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                />
                <button
                  onClick={() => refreshAdminUsers(adminSearch, false)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-lg"
                >
                  {t.adminSearch}
                </button>
              </div>

              {adminError && (
                <div className="mb-4 text-xs text-red-400">{adminError}</div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-4">
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3 max-h-[520px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-wider text-gray-400">{t.adminUsersList}</p>
                    <p className="text-[10px] text-gray-500">{adminLoading ? t.adminLoadingUsers : `${adminUsers.length} ${t.records}`}</p>
                  </div>
                  <div className="space-y-2">
                    {adminUsers.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedAdminUserId(item.id)}
                        className={`w-full text-left rounded-lg border p-3 transition ${
                          selectedAdminUserId === item.id
                            ? 'bg-blue-900/20 border-blue-500'
                            : 'bg-gray-950/50 border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-white font-bold truncate">{item.name || item.username || item.email}</p>
                            <p className="text-[11px] text-gray-400 truncate">{item.email}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                              @{item.username || t.noUsername} · {t.adminSponsor} {item.sponsor_username || '—'}
                            </p>
                          </div>
                          <div className={`text-[10px] px-2 py-1 rounded border ${
                            item.is_blocked
                              ? 'text-red-300 border-red-700 bg-red-900/20'
                              : (item.is_active ? 'text-green-300 border-green-700 bg-green-900/20' : 'text-gray-300 border-gray-700 bg-gray-900/20')
                          }`}>
                            {item.is_blocked ? t.statusBlocked : (item.is_active ? t.statusActive : t.statusInactive)}
                          </div>
                        </div>
                      </button>
                    ))}
                    {!adminLoading && !adminUsers.length && (
                      <div className="text-xs text-gray-500">{t.adminNoUsersFound}</div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
                  {adminDetailLoading && (
                    <div className="text-sm text-gray-400">{t.adminLoadingUserDetail}</div>
                  )}

                  {!adminDetailLoading && adminDetailError && (
                    <div className="text-sm text-red-400">{adminDetailError}</div>
                  )}

                  {!adminDetailLoading && !adminDetailError && !adminDetail && (
                    <div className="text-sm text-gray-500">{t.adminSelectUserHint}</div>
                  )}

                  {!adminDetailLoading && adminDetail?.user && (
                    <div className="space-y-5">
                  {(() => {
                    const isActive = Boolean(adminDetail?.summary?.is_active ?? adminDetail?.user?.is_active);
                    const isBlocked = Boolean(adminDetail?.user?.is_blocked);
                    return (
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <h4 className="text-lg text-white font-bold">{adminDetail.user.name || adminDetail.user.username || adminDetail.user.email}</h4>
                      <p className="text-sm text-gray-400">{adminDetail.user.email}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        UID: <span className="font-mono">{adminDetail.user.auth_user_id || '—'}</span>
                      </p>
                    </div>
                    <div className={`text-xs px-3 py-2 rounded-lg border ${
                      isBlocked
                        ? 'text-red-300 border-red-700 bg-red-900/20'
                        : (isActive ? 'text-green-300 border-green-700 bg-green-900/20' : 'text-gray-300 border-gray-700 bg-gray-900/20')
                    }`}>
                      {isBlocked ? t.userBlockedLabel : (isActive ? t.userActiveLabel : t.userInactiveLabel)}
                    </div>
                  </div>
                    );
                  })()}

                  {(adminTab === 'rede' || adminTab === 'usuarios') && (
                    <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-xs uppercase tracking-wider text-gray-400">{t.adminNetworkEarnings}</p>
                        <p className="text-[10px] text-gray-500">
                          {t.adminDirects} {Number(adminDetail.network?.directs_count || 0)} · {t.adminNetwork} {Number(adminDetail.network?.members_count || 0)}
                        </p>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto">
                        {(Array.isArray(adminDetail.network?.items) ? adminDetail.network.items : []).map((member) => (
                          <div key={member.id} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                            <div className="flex justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm text-white font-bold truncate">{member.name || member.username || member.email}</p>
                                <p className="text-[11px] text-gray-500 truncate">@{member.username || t.noUsername} · {t.adminLevel} {member.level}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] text-gray-400">{t.adminInvested}</p>
                                <p className="text-green-400 font-mono">${toNumber(member.invested_usd).toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="mt-2 flex justify-between text-[11px] text-gray-400">
                              <span>{t.adminEarnings}: ${toNumber(member.commissions_usd).toFixed(2)}</span>
                              <span>{t.adminContractsLabel}: {Number(member.contracts_count || 0)}</span>
                            </div>
                          </div>
                        ))}
                        {!Array.isArray(adminDetail.network?.items) || !adminDetail.network.items.length ? (
                          <div className="text-xs text-gray-500">{t.adminNoNetwork}</div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {adminTab !== 'rede' && (
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminEntryUsd}</p>
                        <p className="text-green-400 font-bold mt-1">${toNumber(adminDetail.summary?.volume_entry_usd).toFixed(2)}</p>
                      </div>
                        <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminExitUsd}</p>
                          <p className="text-red-400 font-bold mt-1">${toNumber(adminDetail.summary?.withdraws_usd ?? adminDetail.summary?.volume_exit_usd).toFixed(2)}</p>
                        </div>
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminVolumeVdt}</p>
                        <p className="text-yellow-300 font-bold mt-1">{toNumber(adminDetail.summary?.volume_vdt).toFixed(2)}</p>
                      </div>
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.adminCommissionsUsd}</p>
                        <p className="text-blue-300 font-bold mt-1">${toNumber(adminDetail.summary?.commissions_usd).toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  {(adminTab === 'suporte' || adminTab === 'usuarios') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4 space-y-3">
                        <p className="text-xs uppercase tracking-wider text-gray-400">Editar usuário</p>
                        <input
                          type="text"
                          placeholder="Nome"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          value={adminEdit.name}
                          onChange={(e) => setAdminEdit((prev) => ({ ...prev, name: e.target.value }))}
                        />
                        <input
                          type="text"
                          placeholder="Username"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          value={adminEdit.username}
                          onChange={(e) => setAdminEdit((prev) => ({ ...prev, username: e.target.value }))}
                        />
                        <input
                          type="text"
                          placeholder="Patrocinador"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          value={adminEdit.sponsor_code}
                          onChange={(e) => setAdminEdit((prev) => ({ ...prev, sponsor_code: e.target.value }))}
                        />
                        <input
                          type="text"
                          placeholder="Idioma"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          value={adminEdit.lang}
                          onChange={(e) => setAdminEdit((prev) => ({ ...prev, lang: e.target.value }))}
                        />
                        <button
                          onClick={handleAdminSaveUser}
                          disabled={adminActionLoading}
                          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3 rounded-lg"
                        >
                          {t.adminSaveUser}
                        </button>
                      </div>

                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4 space-y-3">
                        <p className="text-xs uppercase tracking-wider text-gray-400">{t.adminAdminActions}</p>
                        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-3 space-y-3">
                          <p className="text-xs text-yellow-300 font-bold tracking-wide">PATROCINIO BINARY STORM X</p>
                          <input
                            type="text"
                            placeholder="Username ou e-mail"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                            value={sponsorshipLookup}
                            onChange={(e) => setSponsorshipLookup(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Valor (USD)"
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                              value={sponsorshipAmount}
                              onChange={(e) => setSponsorshipAmount(e.target.value)}
                            />
                            <select
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                              value={sponsorshipAsset}
                              onChange={(e) => setSponsorshipAsset(e.target.value)}
                            >
                              <option value="usdt">USDT</option>
                              <option value="usdc">USDC</option>
                            </select>
                          </div>
                          <textarea
                            placeholder="Observação (opcional)"
                            className="w-full min-h-[70px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                            value={sponsorshipNote}
                            onChange={(e) => setSponsorshipNote(e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSponsorshipLookup(String(adminDetail?.user?.username || adminDetail?.user?.email || ''))}
                              className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-3 py-2 rounded-lg text-xs"
                            >
                              Usar usuário selecionado
                            </button>
                            <button
                              onClick={handleGrantSponsorship}
                              disabled={adminActionLoading}
                              className="bg-yellow-700 hover:bg-yellow-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-xs"
                            >
                              Creditar Patrocínio
                            </button>
                          </div>
                          <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-gray-400">
                              <span>Meta de diretos (300%)</span>
                              <span>{sponsorshipStatusLoading ? 'Carregando...' : `${toNumber(sponsorshipStatus?.percent_total).toFixed(2)}%`}</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-yellow-500 to-green-400 transition-all"
                                style={{ width: `${Math.max(0, Math.min(100, toNumber(sponsorshipStatus?.percent_total)))}%` }}
                              />
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Progresso: ${toNumber(sponsorshipStatus?.progress_total).toFixed(2)} / ${toNumber(sponsorshipStatus?.target_total).toFixed(2)} · Restante: ${toNumber(sponsorshipStatus?.remaining_total).toFixed(2)}
                            </div>
                            {Boolean(sponsorshipStatus?.blocked) ? (
                              <div className="text-[11px] text-red-300">Unilevel bloqueado até cumprir a meta.</div>
                            ) : (
                              <div className="text-[11px] text-green-300">Meta cumprida. Unilevel liberado.</div>
                            )}
                            {sponsorshipStatusError ? (
                              <div className="text-[11px] text-red-400">{sponsorshipStatusError}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={handleAdminSendReset}
                            disabled={adminActionLoading}
                            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg"
                          >
                            {t.adminSendPasswordReset}
                          </button>
                          <button
                            onClick={handleAdminToggleBlocked}
                            disabled={adminActionLoading}
                            className={`${adminDetail.user.is_blocked ? 'bg-green-700 hover:bg-green-600' : 'bg-yellow-700 hover:bg-yellow-600'} disabled:opacity-60 text-white font-bold py-3 rounded-lg`}
                          >
                            {adminDetail.user.is_blocked ? t.adminUnblockUser : t.adminBlockUser}
                          </button>
                        </div>
                        {(canWithdrawManage || canWithdrawApprove) ? (
                        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-200 font-bold">{t.adminWithdrawApprovalTitle}</p>
                              <p className="text-[11px] text-gray-500">{t.adminWithdrawApprovalSubtitle}</p>
                            </div>
                            {canWithdrawManage ? (
                              <label className="inline-flex items-center gap-2 text-[11px] text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={Boolean(adminDetail.user.withdraw_auto_approve)}
                                  onChange={async (e) => {
                                    try {
                                      setAdminActionLoading(true);
                                      const enabled = Boolean(e.target.checked);
                                      const { error } = await supabase.rpc('admin_withdraw_auto_set', {
                                        target_user_id: adminDetail.user.id,
                                        enabled
                                      });
                                      if (error) {
                                        triggerNotification('Admin', error.message || 'Falha ao atualizar saque', 'error');
                                        return;
                                      }
                                      const detailRes = await loadAdminUserDetail(adminDetail.user.id);
                                      if (detailRes.ok) setAdminDetail(detailRes.detail || null);
                                      triggerNotification('Admin', enabled ? t.adminWithdrawAutoEnabled : t.adminWithdrawAutoDisabled, 'success');
                                    } finally {
                                      setAdminActionLoading(false);
                                    }
                                  }}
                                  className="accent-green-500"
                                />
                                {t.adminWithdrawAutoLabel}
                              </label>
                            ) : null}
                          </div>
                          <div className="mt-3 space-y-2">
                            {(Array.isArray(adminDetail.recent_ledger) ? adminDetail.recent_ledger : [])
                              .filter((r) => String(r?.kind || '').toLowerCase() === 'withdraw')
                              .filter((r) => String(r?.meta?.status || '').toLowerCase() !== 'approved')
                              .slice(0, 10)
                              .map((r) => (
                                <div key={r.id} className="bg-gray-950/40 border border-gray-800 rounded-lg p-2 flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[11px] text-gray-200 font-mono truncate">
                                      {r.asset?.toUpperCase?.() || r.asset} {toNumber(r.amount).toFixed(4)}
                                    </p>
                                    <p className="text-[10px] text-gray-500 truncate">
                                      {new Date(r.created_at).toLocaleString()} · {String(r?.meta?.status || 'pending')}
                                    </p>
                                  </div>
                                  {canWithdrawApprove ? (
                                  <button
                                    onClick={async () => {
                                      try {
                                        setAdminActionLoading(true);
                                        const { error } = await supabase.rpc('admin_withdraw_approve', {
                                          withdraw_ledger_id: r.id,
                                          remember_user: false
                                        });
                                        if (error) {
                                          triggerNotification('Admin', error.message || 'Falha ao aprovar saque', 'error');
                                          return;
                                        }
                                        const detailRes = await loadAdminUserDetail(adminDetail.user.id);
                                        if (detailRes.ok) setAdminDetail(detailRes.detail || null);
                                        triggerNotification('Admin', t.adminWithdrawApproved, 'success');
                                      } finally {
                                        setAdminActionLoading(false);
                                      }
                                    }}
                                    disabled={adminActionLoading}
                                    className="bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white font-bold px-3 py-2 rounded-lg text-[11px]"
                                  >
                                    {t.adminWithdrawApproveBtn}
                                  </button>
                                  ) : null}
                                </div>
                              ))}
                            {!((Array.isArray(adminDetail.recent_ledger) ? adminDetail.recent_ledger : [])
                              .some((r) => String(r?.kind || '').toLowerCase() === 'withdraw' && String(r?.meta?.status || '').toLowerCase() !== 'approved')) ? (
                              <div className="text-[11px] text-gray-500">{t.adminWithdrawNoPending}</div>
                            ) : null}
                          </div>
                        </div>
                        ) : null}
                        <textarea
                          placeholder={t.adminBlockReasonPlaceholder}
                          className="w-full min-h-[96px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          value={adminBlockReason}
                          onChange={(e) => setAdminBlockReason(e.target.value)}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(adminDetail.user.email || '');
                                triggerNotification('Admin', t.adminEmailCopied, 'success');
                              } catch {
                                triggerNotification('Admin', t.adminEmailCopyFail, 'error');
                              }
                            }}
                            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg"
                          >
                            {t.adminCopySupportEmail}
                          </button>
                          <button
                            onClick={() => openExternalUrl(`mailto:${encodeURIComponent(adminDetail.user.email || '')}`, { title: 'Email' })}
                            className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg"
                          >
                            {t.adminSupportByEmail}
                          </button>
                        </div>
                        <button
                          onClick={handleAdminDelete}
                          disabled={adminActionLoading}
                          className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-bold py-3 rounded-lg"
                        >
                          {t.adminDeleteUser}
                        </button>
                      </div>
                    </div>
                  )}

                  {(adminTab === 'relatorios' || adminTab === 'usuarios') && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-xs uppercase tracking-wider text-gray-400">{t.adminIndividualReport}</p>
                          <p className="text-[10px] text-gray-500">
                            {t.adminDeposits} ${toNumber(adminDetail.summary?.deposits_usd).toFixed(2)} · {t.adminWithdraws} ${toNumber(adminDetail.summary?.withdraws_usd).toFixed(2)}
                          </p>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {(Array.isArray(adminDetail.recent_ledger) ? adminDetail.recent_ledger : []).map((row) => (
                            <div key={row.id} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 flex justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm text-white font-bold">
                                  {String(row?.kind || '').toLowerCase() === 'deposit' && String(row?.meta?.source || '').toLowerCase() === 'sponsorship'
                                    ? 'PATROCINIO'
                                    : row.kind}
                                </p>
                                <p className="text-[11px] text-gray-500">{row.asset?.toUpperCase?.() || row.asset} · {new Date(row.created_at).toLocaleString()}</p>
                              </div>
                              <div className={`text-sm font-mono ${Number(row.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {Number(row.amount) >= 0 ? '+' : ''}{toNumber(row.amount).toFixed(4)}
                              </div>
                            </div>
                          ))}
                          {!Array.isArray(adminDetail.recent_ledger) || !adminDetail.recent_ledger.length ? (
                            <div className="text-xs text-gray-500">{t.adminNoRecentMoves}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-xs uppercase tracking-wider text-gray-400">{t.adminContractsAndBot}</p>
                          <p className="text-[10px] text-gray-500">
                            {t.adminInvestedSwapLine} ${toNumber(adminDetail.summary?.invested_usd).toFixed(2)} · {t.adminSwap} ${toNumber(adminDetail.summary?.swaps_usd).toFixed(2)}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <div className="space-y-2 max-h-[260px] overflow-y-auto">
                            {(Array.isArray(adminDetail.contracts) ? adminDetail.contracts : []).map((contract) => (
                              <div key={contract.id} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                                <div className="flex justify-between gap-3">
                                  <div>
                                    <p className="text-sm text-white font-bold">{contract.plan_name}</p>
                                    <p className="text-[11px] text-gray-500">{contract.status} · {new Date(contract.created_at).toLocaleDateString()}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-green-400 font-mono">${toNumber(contract.amount).toFixed(2)}</p>
                                    <p className="text-[11px] text-gray-500">{Number(contract.business_days_completed || 0)} {t.adminBusinessDays}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2 max-h-[260px] overflow-y-auto">
                            {(Array.isArray(adminDetail.recent_cycles) ? adminDetail.recent_cycles : []).slice(0, 20).map((cycle) => (
                              <div key={cycle.id} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 flex justify-between gap-3">
                                <div>
                                  <p className="text-sm text-white font-bold">{cycle.mode}</p>
                                  <p className="text-[11px] text-gray-500">{cycle.day_key} · {t.adminCycleLabel} #{cycle.cycle_index}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-blue-300 font-mono">{t.adminGoal} ${toNumber(cycle.target_profit).toFixed(4)}</p>
                                  <p className="text-green-400 font-mono">{t.adminAppliedLower} ${toNumber(cycle.applied_profit).toFixed(4)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }, []);

  const TeamView = () => {
    const usernameId = String(user?.username || '').trim().replace(/^@/, '').toLowerCase();
    const referralBase = 'https://vdextrading.com';
    const referralUrl = usernameId ? `${referralBase}/?register=1&ref=${encodeURIComponent(usernameId)}` : '';
    const referralInputRef = useRef(null);
    const levelHasTeam = (level) => (Array.isArray(teamStats.members) ? teamStats.members : []).some(member => Number(member.level) === Number(level));
    const getQualifierTier = (key) => {
      const tiers = Array.isArray(qualifierStatus?.tiers) ? qualifierStatus.tiers : [];
      return tiers.find(t => String(t?.key || '') === key) || null;
    };
    const qBronze = getQualifierTier('bronze') || { name: 'BRONZE', target: 1000, reward: 100, progress: 0, percent: 0 };
    const qPrata = getQualifierTier('prata') || { name: 'PRATA', target: 10000, reward: 200, progress: 0, percent: 0 };
    const qOuro = getQualifierTier('ouro') || { name: 'OURO', target: 20000, reward: 300, progress: 0, percent: 0 };
    const qDiamante = getQualifierTier('diamante') || { name: 'DIAMANTE', target: 50000, reward: 500, progress: 0, percent: 0 };

    const copy = async () => {
      if (!referralUrl) {
        triggerNotification('Equipe', 'Defina seu username para gerar o link.', 'error');
        return;
      }
      const text = referralUrl;
      const legacyCopy = () => {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        el.style.top = '-9999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        el.setSelectionRange(0, el.value.length);
          const ok = document.execCommand('copy');
        document.body.removeChild(el);
        return ok;
      };
      const directInputCopy = () => {
        const input = referralInputRef.current;
        if (!input) return false;
        input.focus();
        input.select();
        input.setSelectionRange?.(0, String(input.value || '').length);
        return document.execCommand('copy');
      };
      try {
        let copied = false;
        try {
          copied = directInputCopy();
        } catch {}
        if (!copied) {
          try {
            copied = legacyCopy();
          } catch {}
        }
        if (!copied && navigator?.clipboard?.writeText && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
        if (!copied) {
          throw new Error('copy_failed');
        }
        triggerNotification('Equipe', 'Link copiado.', 'success');
      } catch {
        try {
          referralInputRef.current?.focus?.();
          referralInputRef.current?.select?.();
        } catch {}
        triggerNotification('Equipe', 'Não foi possível copiar automaticamente. O link foi selecionado, pressione Ctrl+C.', 'error');
      }
    };

    return (
      <div className="px-4 pb-24 pt-4">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setView('menu')} className="text-gray-400 hover:text-white"><ChevronRight className="rotate-180" /></button>
        <h2 className="text-2xl font-bold text-white">{t.team}</h2>
      </div>

      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-4 md:p-5 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-gray-400 text-xs uppercase tracking-wider">Link de cadastro</p>
            <p className="text-gray-200 text-xs mt-1">
              ID do patrocinador: <span className="font-mono text-gray-100">{usernameId || 'defina seu username'}</span>
            </p>
          </div>
          <button
            onClick={copy}
            className={`shrink-0 text-xs px-3 py-2 rounded-lg border transition ${
              referralUrl
                ? 'bg-gray-800/60 border-gray-700 text-gray-200 hover:bg-gray-800'
                : 'bg-gray-900/40 border-gray-800 text-gray-600 cursor-not-allowed'
            }`}
            disabled={!referralUrl}
          >
            Copiar
          </button>
        </div>

        <div className="mt-3">
          <input
            ref={referralInputRef}
            value={referralUrl || ''}
            readOnly
            className="w-full bg-gray-950/40 border border-gray-800 rounded-xl px-3 py-3 text-[11px] md:text-xs font-mono text-gray-200 focus:outline-none"
            placeholder="Defina seu username para gerar o link"
          />
          <p className="text-[10px] text-gray-500 mt-2">
            Ao abrir este link, o cadastro já vem com o patrocinador preenchido pelo username.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-900 to-purple-800 p-6 rounded-2xl border border-purple-500/30 mb-6 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-20"><Users size={100} /></div>
        <p className="text-purple-200 text-sm">{t.totalDistributed}</p>
        <h3 className="text-3xl font-bold text-white mb-4">{formatCurrency(teamStats.total_commissions || 0)} USD</h3>
        <div className="flex gap-4">
            <div className="bg-black/30 px-3 py-1 rounded-lg flex-1">
                <span className="text-xs text-gray-300 block">{t.unilevel}</span>
                <span className="font-bold text-white">{formatCurrency(teamStats.unilevel_total || 0)} USD</span>
            </div>
            <div className="bg-black/30 px-3 py-1 rounded-lg flex-1">
                <span className="text-xs text-gray-300 block">{t.residual}</span>
                <span className="font-bold text-white">{formatCurrency(teamStats.residual_total || 0)} USD</span>
            </div>
        </div>
      </div>

      <h3 className="text-gray-400 text-sm mb-3 uppercase tracking-wider">Equipe e ganhos</h3>
      <div className="space-y-3 mb-6">
        {(!Array.isArray(teamStats.members) || teamStats.members.length === 0) ? (
          <div className="text-center text-gray-600 py-4 text-sm bg-gray-800 rounded-xl border border-gray-700">Nenhum indicado encontrado.</div>
        ) : (
          teamStats.members.map((member, idx) => (
            <div key={member.user_id || `${member.email}_${idx}`} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-bold truncate">{member.name || member.username || member.email || 'Indicado'}</p>
                  <p className="text-gray-500 text-[10px] font-mono truncate">{member.username ? `@${member.username}` : (member.email || '—')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] px-2 py-1 rounded-full border border-gray-600 text-gray-300">Nível {Number(member.level) || 0}</span>
                  {member.is_direct ? <span className="text-[10px] px-2 py-1 rounded-full border border-purple-500 text-purple-300">Direto</span> : null}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="bg-gray-900/60 rounded-lg p-2 border border-gray-700">
                  <span className="text-[10px] text-gray-500 block uppercase">Unilevel</span>
                  <span className="text-blue-300 text-xs font-mono">{formatCurrency(Number(member.unilevel_total) || 0)} USD</span>
                </div>
                <div className="bg-gray-900/60 rounded-lg p-2 border border-gray-700">
                  <span className="text-[10px] text-gray-500 block uppercase">Residual</span>
                  <span className="text-green-300 text-xs font-mono">{formatCurrency(Number(member.residual_total) || 0)} USD</span>
                </div>
                <div className="bg-gray-900/60 rounded-lg p-2 border border-gray-700">
                  <span className="text-[10px] text-gray-500 block uppercase">Total</span>
                  <span className="text-white text-xs font-mono">{formatCurrency(Number(member.total_commissions) || 0)} USD</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdmin && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-4 md:p-5 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-gray-200 text-sm font-bold">Auditoria (Admin)</p>
              <p className="text-[10px] text-gray-500">indicado → contrato → bot_daily_credits → residual</p>
            </div>
            <button
              onClick={() => setTeamAuditOpen(v => !v)}
              className="shrink-0 text-xs px-3 py-2 rounded-lg border bg-gray-800/60 border-gray-700 text-gray-200 hover:bg-gray-800 transition"
            >
              {teamAuditOpen ? 'Fechar' : 'Abrir'}
            </button>
          </div>

          {teamAuditOpen && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={teamAuditMember}
                  onChange={(e) => setTeamAuditMember(e.target.value)}
                  className="col-span-1 bg-gray-950/40 border border-gray-800 rounded-xl px-3 py-3 text-[11px] md:text-xs font-mono text-gray-200 focus:outline-none"
                  placeholder="username, e-mail ou UID (ex: @cadaster)"
                  list="team-audit-members"
                />
                <datalist id="team-audit-members">
                  {(Array.isArray(teamStats.members) ? teamStats.members : [])
                    .filter((m) => (m?.username || m?.email))
                    .slice(0, 50)
                    .map((m) => {
                      const username = m?.username ? String(m.username) : '';
                      const email = m?.email ? String(m.email) : '';
                      const name = m?.name ? String(m.name) : '';
                      const value = username ? `@${username}` : email;
                      const label = [name || username || email, email && username ? `(${email})` : ''].filter(Boolean).join(' ');
                      return (
                        <option key={m.user_id || email || username || value} value={value}>
                          {label}
                        </option>
                      );
                    })}
                </datalist>
                <input
                  type="date"
                  value={teamAuditDay}
                  onChange={(e) => setTeamAuditDay(e.target.value)}
                  className="col-span-1 bg-gray-950/40 border border-gray-800 rounded-xl px-3 py-3 text-[11px] md:text-xs font-mono text-gray-200 focus:outline-none"
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={teamAuditLimit}
                  onChange={(e) => setTeamAuditLimit(Number(e.target.value || 20))}
                  className="col-span-1 bg-gray-950/40 border border-gray-800 rounded-xl px-3 py-3 text-[11px] md:text-xs font-mono text-gray-200 focus:outline-none"
                  placeholder="limit"
                />
              </div>

              <button
                onClick={async () => {
                  try {
                    setTeamAuditLoading(true);
                    setTeamAuditError(null);
                    const member_username = String(teamAuditMember || '').trim() || null;
                    const audit_day = teamAuditDay ? teamAuditDay : null;
                    const limit_rows = Math.max(1, Math.min(100, Number(teamAuditLimit) || 20));
                    const { data, error } = await supabase.rpc('team_audit', { member_username, audit_day, limit_rows });
                    if (error) throw error;
                    setTeamAuditResult(data);
                  } catch (e) {
                    setTeamAuditError(e?.message || String(e));
                    setTeamAuditResult(null);
                  } finally {
                    setTeamAuditLoading(false);
                  }
                }}
                disabled={teamAuditLoading}
                className={`w-full text-xs px-3 py-3 rounded-xl border transition ${
                  teamAuditLoading
                    ? 'bg-gray-900/40 border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-800/60 border-gray-700 text-gray-200 hover:bg-gray-800'
                }`}
              >
                {teamAuditLoading ? 'Carregando...' : 'Rodar auditoria'}
              </button>

              {teamAuditError && (
                <div className="text-[11px] text-red-400 bg-red-900/10 border border-red-900/30 rounded-xl px-3 py-2">
                  {teamAuditError}
                </div>
              )}

              {teamAuditResult?.summary && (
                <div className="grid grid-cols-5 gap-2">
                  <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Membros</div>
                    <div className="text-gray-100 font-mono text-xs">{Number(teamAuditResult.summary.members) || 0}</div>
                  </div>
                  <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Dias</div>
                    <div className="text-gray-100 font-mono text-xs">{Number(teamAuditResult.summary.contract_days) || 0}</div>
                  </div>
                  <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Créditos</div>
                    <div className="text-gray-100 font-mono text-xs">{Number(teamAuditResult.summary.bot_credits ?? 0) || 0}</div>
                  </div>
                  <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Lucro</div>
                    <div className="text-gray-100 font-mono text-xs">{formatCurrency(Number(teamAuditResult.summary.bot_profit ?? teamAuditResult.summary.cycles_profit) || 0)} USD</div>
                  </div>
                  <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Residual</div>
                    <div className="text-gray-100 font-mono text-xs">{formatCurrency(Number(teamAuditResult.summary.residual_paid) || 0)} USD</div>
                  </div>
                </div>
              )}

              {teamAuditResult && (
                <details className="bg-gray-950/40 border border-gray-800 rounded-2xl p-3">
                  <summary className="cursor-pointer text-gray-200 text-xs">Ver JSON</summary>
                  <pre className="mt-3 text-[10px] text-gray-300 overflow-auto max-h-[320px]">
{JSON.stringify(teamAuditResult, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      <h3 className="text-gray-400 text-sm mb-3 uppercase tracking-wider">{t.commissionPlan}</h3>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-6">
          <div className="grid grid-cols-4 bg-gray-900 p-2 text-xs text-gray-400 font-bold border-b border-gray-700">
              <span className="col-span-1 text-center">Nível</span>
              <span className="col-span-1 text-center text-blue-400">Unilevel</span>
              <span className="col-span-1 text-center text-green-400">Residual</span>
              <span className="col-span-1 text-center">Status</span>
          </div>
          {NETWORK_PLAN.map((item, idx) => (
              <div key={idx} className="grid grid-cols-4 p-3 border-b border-gray-700/50 last:border-0 text-sm items-center">
                  <div className="col-span-1 flex justify-center">
                      <span className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
                          {item.level}
                      </span>
                  </div>
                  <span className="col-span-1 text-center text-blue-300 font-mono">{item.percent}%</span>
                  <span className="col-span-1 text-center text-green-300 font-mono">{item.percent}%</span>
                  <span className="col-span-1 text-center">
                      {levelHasTeam(item.level) ? <span className="text-green-500 text-[10px] border border-green-500 px-1 rounded">ATIVO</span> : <Lock size={12} className="mx-auto text-gray-600" />}
                  </span>
              </div>
          ))}
      </div>

      <h3 className="text-gray-400 text-sm mb-3 uppercase tracking-wider mt-6">Bônus Qualificador</h3>
      <div className="space-y-4 mb-6">
          <div className="bg-gradient-to-r from-orange-800 to-orange-900 p-4 rounded-xl border border-orange-500/30">
              <div className="flex justify-between items-center mb-2">
                  <h4 className="text-orange-300 font-bold text-lg flex items-center gap-2">{qBronze.name}</h4>
                  <span className="text-green-400 font-bold">+${formatCurrency(Number(qBronze.reward) || 0)} USD</span>
              </div>
              <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Progresso: ${formatCurrency(Number(qBronze.progress) || 0)} USD</span>
                  <span>Meta: ${formatCurrency(Number(qBronze.target) || 0)} USD</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{width: `${Math.max(0, Math.min(100, Number(qBronze.percent) || 0))}%`}}></div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Apenas comissões no nível 1. A cada nível atingido o progresso é zerado.</p>
          </div>

          <div className="bg-gradient-to-r from-gray-500 to-gray-700 p-4 rounded-xl border border-gray-400/30">
              <div className="flex justify-between items-center mb-2">
                  <h4 className="text-gray-100 font-bold text-lg flex items-center gap-2">{qPrata.name}</h4>
                  <span className="text-green-400 font-bold">+${formatCurrency(Number(qPrata.reward) || 0)} USD</span>
              </div>
              <div className="flex justify-between text-xs text-gray-200 mb-1">
                  <span>Progresso: ${formatCurrency(Number(qPrata.progress) || 0)} USD</span>
                  <span>Meta: ${formatCurrency(Number(qPrata.target) || 0)} USD</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2">
                  <div className="bg-gray-300 h-2 rounded-full" style={{width: `${Math.max(0, Math.min(100, Number(qPrata.percent) || 0))}%`}}></div>
              </div>
              <p className="text-[10px] text-gray-300 mt-2">Apenas comissões no nível 1. A cada nível atingido o progresso é zerado.</p>
          </div>

          <div className="bg-gradient-to-r from-yellow-600 to-yellow-800 p-4 rounded-xl border border-yellow-500/30">
              <div className="flex justify-between items-center mb-2">
                  <h4 className="text-yellow-300 font-bold text-lg flex items-center gap-2">{qOuro.name}</h4>
                  <span className="text-green-400 font-bold">+${formatCurrency(Number(qOuro.reward) || 0)} USD</span>
              </div>
              <div className="flex justify-between text-xs text-gray-200 mb-1">
                  <span>Progresso: ${formatCurrency(Number(qOuro.progress) || 0)} USD</span>
                  <span>Meta: ${formatCurrency(Number(qOuro.target) || 0)} USD</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2">
                  <div className="bg-yellow-400 h-2 rounded-full" style={{width: `${Math.max(0, Math.min(100, Number(qOuro.percent) || 0))}%`}}></div>
              </div>
              <p className="text-[10px] text-gray-300 mt-2">Apenas comissões no nível 1. A cada nível atingido o progresso é zerado.</p>
          </div>

          <div className="bg-gradient-to-r from-cyan-700 to-cyan-900 p-4 rounded-xl border border-cyan-500/30">
              <div className="flex justify-between items-center mb-2">
                  <h4 className="text-cyan-300 font-bold text-lg flex items-center gap-2">{qDiamante.name}</h4>
                  <span className="text-green-400 font-bold">+${formatCurrency(Number(qDiamante.reward) || 0)} USD</span>
              </div>
              <div className="flex justify-between text-xs text-gray-200 mb-1">
                  <span>Progresso: ${formatCurrency(Number(qDiamante.progress) || 0)} USD</span>
                  <span>Meta: ${formatCurrency(Number(qDiamante.target) || 0)} USD</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2">
                  <div className="bg-cyan-400 h-2 rounded-full" style={{width: `${Math.max(0, Math.min(100, Number(qDiamante.percent) || 0))}%`}}></div>
              </div>
              <p className="text-[10px] text-gray-300 mt-2">Apenas comissões no nível 1. A cada nível atingido o progresso é zerado.</p>
          </div>
      </div>

      <h3 className="text-gray-400 text-sm mb-3 uppercase tracking-wider">Histórico Recente</h3>
      <div className="space-y-3">
        {(!Array.isArray(teamStats.recent) || teamStats.recent.length === 0) ? (
            <div className="text-center text-gray-600 py-4 text-sm">Nenhuma comissão recente.</div>
        ) : (
            teamStats.recent.slice(0, 5).map((h, i) => (
                <div key={i} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center border border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${h.kind === 'unilevel' ? 'bg-blue-900 text-blue-400' : 'bg-green-900 text-green-400'}`}>
                            {h.kind === 'unilevel' ? 'U' : 'R'}
                        </div>
                        <div>
                            <p className="text-white text-sm capitalize">{h.kind} Bonus</p>
                            <p className="text-gray-500 text-[10px]">
                              {h.source_username ? `@${h.source_username}` : (h.source_name || (h.meta?.level ? `Nível ${h.meta.level}` : ''))}
                              {(h.asset && String(h.asset).toLowerCase() !== 'usd') ? ` · ${String(h.asset).toUpperCase()}` : ''}
                            </p>
                        </div>
                    </div>
                    <span className="text-green-400 text-xs font-mono">+ {formatCurrency(Number(h.amount || 0))} USD</span>
                </div>
            ))
        )}
      </div>
    </div>
    );
  };

  const ReportsView = () => {
    const tabs = [
      { id: 'all', label: t.reportsTabAll },
      { id: 'entries', label: t.reportsTabEntries },
      { id: 'exits', label: t.reportsTabExits },
      { id: 'bots', label: t.reportsTabBots }
    ];

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const isBotTx = (tx) => tx?.type?.startsWith('plan_') || tx?.type === 'hft_profit';
    const isEntryTx = (tx) => {
      const type = tx?.type;
      if (!type) return false;
      if (type === 'hft_profit') return num(tx.amount) > 0;
      return type === 'deposit' || type === 'unilevel' || type === 'residual' || type.includes('bonus') || type === 'game_win' || type === 'swap';
    };
    const isExitTx = (tx) => {
      const type = tx?.type;
      if (!type) return false;
      if (type === 'hft_profit') return num(tx.amount) < 0;
      return type === 'withdraw' || type === 'plan_activation' || type === 'plan_upgrade' || type === 'game_loss' || type === 'energy_buy';
    };

    const filtered = user.history.filter((tx) => {
      if (reportsTab === 'entries') return isEntryTx(tx);
      if (reportsTab === 'exits') return isExitTx(tx);
      if (reportsTab === 'bots') return isBotTx(tx);
      return true;
    });

    const visible = (() => {
      if (reportsTab !== 'bots') return filtered;
      const range = computeBotsRange();
      if (!range) return filtered;
      return botsHistory;
    })();

    const getTitle = (tx) => {
      if (tx.type === 'plan_activation') return t.txPlanActivation;
      if (tx.type === 'plan_upgrade') return t.txPlanUpgrade;
      if (tx.type === 'hft_profit') return t.txHftProfit;
      if (tx.type === 'bot_pause') return t.txBotPause;
      if (tx.type === 'bot_resume') return t.txBotResume;
      if (tx.type === 'deposit') return t.txDeposit;
      if (tx.type === 'withdraw') return t.txWithdraw;
      if (tx.type === 'swap') return t.txSwap;
      if (tx.type === 'unilevel') return t.txUnilevelBonus;
      if (tx.type === 'residual') return t.txResidualBonus;
      if (tx.type === 'game_win') return t.txGameWin;
      if (tx.type === 'game_loss') return t.txGameLoss;
      if (tx.type === 'energy_buy') return t.txEnergyBuy;
      return (tx.type || '').replaceAll('_', ' ');
    };

    const getMeta = (tx) => {
      const localeForLang = (lang) => {
        if (lang === 'es') return 'es-ES';
        if (lang === 'en') return 'en-US';
        return 'pt-BR';
      };

      const formatNyDateTime = (ts) => {
        const v = Number(ts);
        if (!Number.isFinite(v) || v <= 0) return '';
        return new Intl.DateTimeFormat(localeForLang(lang), {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(v));
      };

      if (reportsTab === 'bots') {
        const dayKey = tx?.meta?.day_key ? String(tx.meta.day_key) : '';
        const when = dayKey ? `${dayKey} 19:00` : formatNyDateTime(tx?.ts);
        const suffix = tx.desc ? ` · ${tx.desc}` : '';
        return `${when}${suffix}`.trim();
      }

      const when = formatNyDateTime(tx?.ts) || tx.date || '';
      if (tx.desc && when) return `${when} · ${tx.desc}`;
      if (when) return when;
      return tx.desc || '';
    };

    const getFlow = (tx) => {
      if (tx.type === 'hft_profit') return num(tx.amount) >= 0 ? 'in' : 'out';
      if (isExitTx(tx)) return 'out';
      if (isEntryTx(tx)) return 'in';
      return 'neutral';
    };

    const getUnit = (tx) => {
      if (tx?.type === 'game_win' || tx?.type === 'game_loss') return 'VDT';
      if (tx?.type === 'energy_buy') return 'VDT';
      if (tx?.type === 'swap') {
        const desc = String(tx?.desc || '');
        if (desc.includes('VDT -> USD')) return 'USD';
        if (desc.includes('USD ->')) return 'VDT';
      }
      return 'USD';
    };

    const formatAmount = (tx) => {
      const n = num(tx.amount);
      const flow = getFlow(tx);
      const abs = Math.abs(n);
      const fixed = tx.type === 'hft_profit' ? abs.toFixed(4) : abs.toFixed(2);
      const unit = getUnit(tx);
      const prefix = unit === 'USD' ? '$' : '';
      if (flow === 'out') return `-${prefix}${fixed} ${unit}`;
      if (flow === 'in') return `+${prefix}${fixed} ${unit}`;
      return `${prefix}${fixed} ${unit}`;
    };

    const iconFor = (tx) => {
      if (tx.type === 'deposit') return <Plus size={14} />;
      if (tx.type === 'withdraw') return <Minus size={14} />;
      if (tx.type === 'swap') return <ArrowRightLeft size={14} />;
      if (tx.type === 'unilevel' || tx.type === 'residual' || (tx.type || '').includes('bonus')) return <Users size={14} />;
      if ((tx.type || '').startsWith('plan_')) return <Zap size={14} />;
      if (tx.type === 'hft_profit') return <TrendingUp size={14} />;
      if (tx.type === 'game_win' || tx.type === 'game_loss') return <Gamepad2 size={14} />;
      if (tx.type === 'energy_buy') return <Battery size={14} />;
      return <Activity size={14} />;
    };

    const iconClass = (tx) => {
      if (tx.type === 'deposit') return 'bg-green-500/20 text-green-400';
      if (tx.type === 'withdraw') return 'bg-red-500/20 text-red-400';
      if (tx.type === 'swap') return 'bg-cyan-500/20 text-cyan-300';
      if (tx.type === 'unilevel' || tx.type === 'residual' || (tx.type || '').includes('bonus')) return 'bg-purple-500/20 text-purple-300';
      if ((tx.type || '').startsWith('plan_')) return 'bg-yellow-500/20 text-yellow-300';
      if (tx.type === 'hft_profit') return num(tx.amount) >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400';
      if (tx.type === 'energy_buy') return 'bg-blue-500/20 text-blue-300';
      return 'bg-gray-500/10 text-gray-300';
    };

    const amountClass = (tx) => {
      const flow = getFlow(tx);
      if (flow === 'in') return 'text-green-400';
      if (flow === 'out') return 'text-red-400';
      return 'text-white';
    };

    return (
      <div className="px-4 pb-24 pt-4 animate-fadeIn">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setView('menu')} className="text-gray-400 hover:text-white"><ChevronRight className="rotate-180" /></button>
          <h2 className="text-2xl font-bold text-white">{t.reports}</h2>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setReportsTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap border transition ${reportsTab === tab.id ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black border-yellow-500/30' : 'bg-gray-800/60 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {reportsTab === 'bots' && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-gray-500">{t.reportsBotsPeriod}</span>
            {[
              { id: 'today', label: t.reportsBotsToday },
              { id: 'yesterday', label: t.reportsBotsYesterday },
              { id: '7d', label: t.reportsBots7d },
              { id: '30d', label: t.reportsBots30d }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  if (botsRange !== opt.id) {
                    setBotsRange(opt.id);
                    setBotsOffset(0);
                  }
                }}
                className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap border transition ${botsRange === opt.id ? 'bg-gray-200 text-black font-black border-gray-200' : 'bg-gray-800/60 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {reportsTab === 'bots' && botsRange !== 'today' && botsLoading ? (
          <div className="text-center text-gray-400 py-10 text-sm">{t.reportsBotsLoading}</div>
        ) : (reportsTab === 'bots' && botsRange !== 'today' && botsLoadError) ? (
          <div className="text-center text-red-400 py-10 text-sm">{botsLoadError}</div>
        ) : visible.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">{t.reportsNoTx}</div>
        ) : (
          <div className="space-y-3">
            {visible.map((tx, idx) => (
              <div key={tx.id || idx} className="bg-gray-800/50 p-4 rounded-lg flex justify-between items-center border border-gray-700/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClass(tx)}`}>
                    {iconFor(tx)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-bold truncate">{getTitle(tx)}</p>
                    <p className="text-gray-500 text-xs truncate">{getMeta(tx)}</p>
                  </div>
                </div>
                <span className={`font-mono font-bold ${amountClass(tx)}`}>{formatAmount(tx)}</span>
              </div>
            ))}
          </div>
        )}

        {reportsTab === 'bots' && botsRange !== 'today' && botsHistory.length > 0 && botsHistory.length % 50 === 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setBotsOffset(prev => prev + 50)}
              disabled={botsLoading}
              className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm border border-gray-700 hover:bg-gray-700 disabled:opacity-50 transition"
            >
              {botsLoading ? t.reportsBotsLoading : t.reportsLoadMore || 'Carregar mais'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const BottomNav = () => (
    <div className="w-full bg-gray-950/40 backdrop-blur-2xl border-t border-gray-800/50 p-2 pb-[env(safe-area-inset-bottom,20px)] shrink-0 fixed bottom-0 left-0 right-0 z-[60] md:hidden">
      <div className="flex justify-around items-center max-w-md mx-auto">
        <NavBtn icon={TrendingUp} id="home" label={t.navHome} active={view === 'home'} />
        <NavBtn icon={Gamepad2} id="game" label={t.navGame} active={view === 'game'} />
        
        {/* Botão Central Destacado BOTS */}
        <div className="relative -top-6">
          <button 
            onClick={() => setView('plans')}
            className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center border-4 border-gray-900 shadow-[0_0_20px_#2563eb] transform hover:scale-110 transition text-white"
          >
            <Zap size={32} className="fill-current" />
          </button>
          <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[10px] font-bold text-blue-400">{t.navBots}</span>
        </div>

        <NavBtn icon={Wallet} id="wallet" label={t.navWallet} active={view === 'wallet'} />
        <NavBtn icon={MenuIcon} id="menu" label={t.navMenu} active={view === 'menu' || view === 'support' || view === 'team' || view === 'reports' || view === 'settings'} />
      </div>
    </div>
  );

  const NavBtn = ({ icon: Icon, id, label, active }) => (
    <button 
      onClick={() => {
        if (id === 'wallet' && walletBlockedForCurrentUser) {
          triggerNotification('Wallet', `Wallet em MAINTENANCE${walletGate?.prelaunch_until ? ` até ${walletGate.prelaunch_until}` : ''}.`, 'error');
          return;
        }
        setView(id);
      }}
      className={`flex flex-col items-center p-2 transition ${active ? 'text-yellow-500' : 'text-gray-500 hover:text-gray-300'}`}
    >
      <Icon size={20} />
      <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
  );

  const SidebarBtn = ({ icon: Icon, id, label, active }) => (
    <button 
      onClick={() => {
        if (id === 'wallet' && walletBlockedForCurrentUser) {
          triggerNotification('Wallet', `Wallet em MAINTENANCE${walletGate?.prelaunch_until ? ` até ${walletGate.prelaunch_until}` : ''}.`, 'error');
          return;
        }
        setView(id);
      }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${active ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
    >
      <Icon size={20} />
      <span className="font-bold">{label}</span>
    </button>
  );

  return (
    <div className="w-full h-[100svh] text-gray-100 font-sans selection:bg-yellow-500/30 flex justify-center md:justify-start fixed left-0 top-0 overflow-hidden md:bg-app-desktop bg-app-mobile">
      {/* OVERLAY DE SOMBRA PARA O BACKOFFICE */}
      <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none"></div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-scan { animation: scan 3s linear infinite; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
        .animate-slideInLeft { animation: slideInLeft 0.3s ease-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
      `}</style>

      {/* Sidebar Desktop/Tablet */}
      <div className="hidden md:flex flex-col w-64 bg-gray-950/40 backdrop-blur-xl border-r border-gray-800/50 z-50 p-4 shrink-0 shadow-2xl h-full sticky top-0 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
         <div className="mb-6 mt-2 text-center h-32 relative overflow-hidden">
             <img src="/logo/logoVdex.png" alt="VDexTrading" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-32 md:h-36 w-auto max-w-none select-none pointer-events-none drop-shadow-[0_0_12px_rgba(234,179,8,0.35)]" />
         </div>
         <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
             <SidebarBtn icon={TrendingUp} id="home" label={t.navHome} active={view === 'home'} />
             <SidebarBtn icon={Gamepad2} id="game" label={t.navGame} active={view === 'game'} />
             <SidebarBtn icon={Zap} id="plans" label={t.navBots} active={view === 'plans'} />
             <SidebarBtn icon={Wallet} id="wallet" label={t.navWallet} active={view === 'wallet'} />
             <div className="my-2 border-b border-gray-800"></div>
             <SidebarBtn icon={Users} id="team" label={t.navNetwork} active={view === 'team'} />
             <SidebarBtn icon={FileText} id="reports" label={t.navReports} active={view === 'reports'} />
             <SidebarBtn icon={Settings} id="settings" label={t.navSettings} active={view === 'settings'} />
             <SidebarBtn icon={ShieldCheck} id="support" label={t.navSupport} active={view === 'support'} />
         </div>
         <button onClick={onLogout} className="mt-6 shrink-0 flex items-center justify-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition border border-red-500/20">
             <LogOut size={20} /> <span className="font-bold">{t.navLogout}</span>
         </button>
      </div>
      
      <div className="w-full md:flex-1 lg:max-w-6xl mx-auto bg-gray-950/40 backdrop-blur-md relative shadow-2xl h-full flex flex-col md:border-x border-gray-900/50 overflow-hidden pb-[5rem] md:pb-0 z-0">
        <Header />
        
        <main ref={mainScrollRef} className="flex-1 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar relative pt-[env(safe-area-inset-top)] z-10 pb-[env(safe-area-inset-bottom,20px)]">
            <div className={view === 'home' ? '' : 'hidden'}>
              <HomeView />
            </div>
            
            {view === 'game' && (
            <GameView 
                t={t} 
                user={user} 
                gameEvents={gameEvents}
                handleConsumeEnergy={handleConsumeEnergy}
                handleQuantumGameOver={handleQuantumGameOver}
                handleVaultResult={handleVaultResult}
                handleBuyEnergy={handleBuyEnergy}
                formatVDT={formatVDT}
            />
            )}
            
            {view === 'plans' && <PlansView t={t} handleActivatePlan={handleActivatePlan} user={user} userBalance={(Number(user.balances.usdt) || 0) + (Number(user.balances.usdc) || 0)} />}
            
            {view === 'wallet' && (
              walletBlockedForCurrentUser ? (
                <div className="px-4 pt-4 pb-24">
                  <div className="bg-gray-900/60 border border-red-500/30 rounded-2xl p-5 max-w-2xl mx-auto">
                    <p className="text-red-300 text-xs tracking-wider uppercase font-bold">MAINTENANCE ACTIVE</p>
                    <h3 className="text-white text-xl font-black mt-2">Wallet temporariamente bloqueada</h3>
                    <p className="text-gray-300 text-sm mt-2">
                      Nesta fase de posicionamento, depósitos/saques/trocas ficarão disponíveis no lançamento.
                    </p>
                    <p className="text-gray-400 text-xs mt-2">
                      {walletGate?.prelaunch_until ? `Previsão de liberação: ${walletGate.prelaunch_until}` : 'Aguardando liberação pelo admin.'}
                    </p>
                  </div>
                </div>
              ) : (
                <WalletView 
                  t={t} 
                  user={user} 
                  formatCurrency={formatCurrency}
                  formatVDT={formatVDT} 
                  handleDepositAction={handleDepositAction}
                  handleWithdrawAction={handleWithdrawAction}
                  handleSwapAction={handleSwapAction}
                  pendingNowPays={pendingNowPays}
                  onResumeNowPay={resumePendingNowPay}
                  onSyncNowPay={syncPendingNowPay}
                />
              )
            )}
            
            {view === 'menu' && <MenuView />}
            {view === 'team' && <TeamView />}
            {view === 'reports' && <ReportsView />}
            {view === 'support' && (
              <SupportView
                t={t}
                setView={setView}
                triggerNotification={triggerNotification}
                initialSelectedId={supportJumpTicketId}
                onConsumeInitialSelectedId={() => setSupportJumpTicketId(null)}
              />
            )}
            {view === 'settings' && (
              <SettingsView
                t={t}
                user={user}
                isAdmin={isAdmin}
                setView={setView}
                handleSaveSettings={handleSaveSettings}
              />
            )}
            {view === 'admin' && (
              <AdminPanelView
                t={t}
                isAdmin={isAdmin}
                adminPerms={adminPerms}
                setView={setView}
                triggerNotification={triggerNotification}
                toNumber={toNumber}
                loadAdminUsers={loadAdminUsers}
                loadAdminUserDetail={loadAdminUserDetail}
                walletGate={walletGate}
                loadWalletGate={loadWalletGate}
                walletGateLoading={walletGateLoading}
              />
            )}
        </main>

        <div className="md:hidden">
            <BottomNav />
        </div>
        <NotificationsPanel />

        {nowPayOpen && nowPayData && (
          <div className="absolute inset-0 z-[80]">
            <div className="absolute inset-0 bg-black/70" onClick={() => setNowPayOpen(false)}></div>
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-xl bg-gray-950/95 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-blue-300 font-bold tracking-wide">NOWPAYMENTS</p>
                    <p className="text-white font-black text-lg mt-1">Pagamento criado</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Envie o valor exato para o endereço abaixo. Após confirmação, o saldo será creditado automaticamente.
                    </p>
                  </div>
                  <button
                    onClick={() => setNowPayOpen(false)}
                    className="shrink-0 bg-gray-900/60 hover:bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-xs"
                  >
                    Fechar
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Moeda</p>
                    <p className="text-white font-mono font-bold mt-1">{nowPayData.pay_currency || '—'}</p>
                  </div>
                  <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Valor</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-white font-mono font-bold">
                        {(() => {
                          const n = Number(nowPayData.pay_amount);
                          if (!Number.isFinite(n) || n <= 0) return '—';
                          const s = n.toFixed(8).replace(/0+$/g, '').replace(/\.$/, '');
                          return s;
                        })()}
                      </p>
                      <button
                        onClick={() => copyText(String(nowPayData.pay_amount || ''), 'Valor copiado.')}
                        className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-3 py-2 rounded-lg text-xs"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Crédito na Wallet</p>
                  <p className="text-white font-bold mt-1">
                    {(() => {
                      const n = Number(nowPayData.price_amount);
                      if (!Number.isFinite(n) || n <= 0) return '—';
                      return `$${n.toFixed(2)} ${String(nowPayData.deposit_asset || 'USDT').toUpperCase()}`;
                    })()}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Se sua corretora desconta taxa do valor enviado, envie um pouco a mais para garantir que o valor recebido bata com o solicitado. Status parcial não credita.
                  </p>
                </div>

                <div className="mt-3 bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Carteira (endereço)</p>
                  <div className="flex items-start justify-between gap-2 mt-2">
                    <p className="text-white font-mono text-xs break-all">{nowPayData.pay_address || '—'}</p>
                    <button
                      onClick={() => copyText(nowPayData.pay_address, 'Carteira copiada.')}
                      className="shrink-0 bg-blue-700 hover:bg-blue-600 text-white font-bold px-3 py-2 rounded-lg text-xs"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {nowPayData.invoice_url ? (
                    <a
                      href={nowPayData.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-green-700 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-lg text-xs"
                    >
                      Abrir QR Code
                    </a>
                  ) : null}
                  <button
                    onClick={() => setDepositSupportOpen(true)}
                    className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs"
                  >
                    {t.depositSupportOpenFromNow || 'Abrir suporte do depósito'}
                  </button>
                  <button
                    onClick={() => setNowPayOpen(false)}
                    className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-lg text-xs"
                  >
                    Ok
                  </button>
                </div>

                <div className="mt-2 text-[11px] text-gray-500">
                  Pedido: {nowPayData.order_id || '—'} {nowPayData.payment_id ? `· Pagamento: ${nowPayData.payment_id}` : ''}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  Valor digitado: ${Number(nowPayData.requested_amount || 0).toFixed(2)} / Valor aplicado: ${Number(nowPayData.price_amount || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {externalLinkFallback?.url ? (
          <div className="absolute inset-0 z-[90]">
            <div className="absolute inset-0 bg-black/70" onClick={() => setExternalLinkFallback(null)}></div>
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-gray-950/95 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-yellow-300 font-bold tracking-wide uppercase">Popup bloqueado</p>
                    <p className="text-white font-black text-lg mt-1">{externalLinkFallback.title || 'Link externo'}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Seu navegador bloqueou a abertura automática. Clique no botão abaixo para abrir manualmente.
                    </p>
                  </div>
                  <button
                    onClick={() => setExternalLinkFallback(null)}
                    className="shrink-0 bg-gray-900/60 hover:bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-xs"
                  >
                    Fechar
                  </button>
                </div>

                <div className="mt-3 bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Link</p>
                  <p className="text-white font-mono text-[11px] break-all mt-2">{externalLinkFallback.url}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={externalLinkFallback.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-green-700 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-lg text-xs"
                  >
                    Clique aqui para abrir
                  </a>
                  <button
                    onClick={() => copyText(externalLinkFallback.url, 'Link copiado.')}
                    className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs"
                  >
                    Copiar link
                  </button>
                  <button
                    onClick={() => setExternalLinkFallback(null)}
                    className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-lg text-xs"
                  >
                    Ok
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <DepositSupportModal
          open={depositSupportOpen}
          onClose={() => setDepositSupportOpen(false)}
          nowPayData={nowPayData}
          t={t}
          triggerNotification={triggerNotification}
          onCreated={(ticketId) => {
            setSupportJumpTicketId(ticketId);
            setDepositSupportOpen(false);
            setNowPayOpen(false);
            setView('support');
          }}
        />

        {/* Toast Notification */}
        {toast && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[70] animate-slideDown w-[90%] max-w-sm pointer-events-none">
            {(() => {
                const type = toast.type || 'info';
                const styles = {
                    success: {
                        bg: 'bg-green-950/95 border-green-500/40 shadow-[0_0_30px_rgba(34,197,94,0.2)]',
                        iconBg: 'bg-green-500/20 border-green-500/30',
                        iconColor: 'text-green-400',
                        titleColor: 'text-green-400',
                        dotColor: 'bg-green-400 shadow-[0_0_8px_#4ade80]',
                        label: toast.title || 'PROFIT REPORT',
                        Icon: TrendingUp
                    },
                    error: {
                        bg: 'bg-red-950/95 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.2)]',
                        iconBg: 'bg-red-500/20 border-red-500/30',
                        iconColor: 'text-red-400',
                        titleColor: 'text-red-400',
                        dotColor: 'bg-red-400 shadow-[0_0_8px_#f87171]',
                        label: toast.title || 'SYSTEM ALERT',
                        Icon: AlertTriangle
                    },
                    info: {
                        bg: 'bg-gray-900/95 border-blue-500/40 shadow-[0_0_30px_rgba(37,99,235,0.2)]',
                        iconBg: 'bg-blue-500/20 border-blue-500/30',
                        iconColor: 'text-blue-400',
                        titleColor: 'text-blue-400',
                        dotColor: 'bg-blue-400 shadow-[0_0_8px_#60a5fa]',
                        label: toast.title || 'SYSTEM UPDATE',
                        Icon: Zap
                    }
                }[type] || {
                        bg: 'bg-gray-900/95 border-blue-500/40 shadow-[0_0_30px_rgba(37,99,235,0.2)]',
                        iconBg: 'bg-blue-500/20 border-blue-500/30',
                        iconColor: 'text-blue-400',
                        titleColor: 'text-blue-400',
                        dotColor: 'bg-blue-400 shadow-[0_0_8px_#60a5fa]',
                        label: toast.title || 'SYSTEM UPDATE',
                        Icon: Zap
                };

                const { Icon } = styles;

                return (
                    <div className={`${styles.bg} backdrop-blur-xl border px-5 py-4 rounded-2xl flex items-center gap-4 transition-all duration-300 pointer-events-auto`}>
                    <div className={`shrink-0 w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center border shadow-inner`}>
                        <Icon size={24} className={styles.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-[10px] ${styles.titleColor} font-bold uppercase tracking-widest mb-1 flex items-center gap-2`}>
                            <span className={`w-2 h-2 ${styles.dotColor} rounded-full animate-pulse`}></span>
                            {styles.label}
                        </p>
                        <p className="text-sm font-medium text-white leading-tight break-words drop-shadow-sm">
                            {toast.msg}
                        </p>
                    </div>
                    </div>
                );
            })()}
            </div>
        )}
      </div>
    </div>
  );
}

/**
 * COMPONENTE PRINCIPAL (CONTROLLER)
 * Gerencia o fluxo entre Landing Page, Auth e Dashboard
 */
export default function App() {
  // Estados de Roteamento
  const [currentView, setCurrentView] = useState('landing'); // landing, auth, reset_password, dashboard
  const [currentUser, setCurrentUser] = useState(null);
  const authBootstrappedRef = useRef(false);

  const isRecoveryUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = String(params.get('mode') || '').toLowerCase();
    const hash = String(window.location.hash || '').toLowerCase();
    return mode === 'recovery' || hash.includes('type=recovery');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasRef = Boolean((params.get('ref') || params.get('sponsor') || '').trim());
    const mode = (params.get('mode') || '').toLowerCase();
    const register = (params.get('register') || '').trim();
    if (mode === 'recovery') {
      setCurrentView('reset_password');
      return;
    }
    if (hasRef || mode === 'register' || register === '1') {
      setCurrentView('auth');
    }
  }, []);

  // Inicialização: Verifica se já existe sessão ativa
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const email = data?.session?.user?.email;
      if (email) {
        const safeUser = { ...SAFE_USER_DEFAULTS, email: String(email).toLowerCase() };
        setCurrentUser(safeUser);
        setCurrentView(isRecoveryUrl() ? 'reset_password' : 'dashboard');
      }
      authBootstrappedRef.current = true;
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESH_FAILED') {
        clearSupabaseAuthStorage();
        setCurrentUser(null);
        setCurrentView('landing');
        return;
      }
      const email = session?.user?.email;
      if (!email) {
        if (event !== 'SIGNED_OUT') return;
        setCurrentUser(null);
        setCurrentView('landing');
        return;
      }
      const safeUser = { ...SAFE_USER_DEFAULTS, email: String(email).toLowerCase() };
      setCurrentUser(safeUser);
      if (event === 'PASSWORD_RECOVERY' || isRecoveryUrl()) {
        setCurrentView('reset_password');
      } else {
        setCurrentView('dashboard');
      }
      authBootstrappedRef.current = true;
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleNavigateToAuth = () => {
    setCurrentView('auth');
  };

  const handleLoginSuccess = (user) => {
    const email = String(user?.email || '').toLowerCase();
    const merged = { ...SAFE_USER_DEFAULTS, ...user, email };
    setCurrentUser(merged);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    supabase.auth.signOut().catch(() => {});
    setCurrentUser(null);
    setCurrentView('landing'); // Volta para a Landing Page ao sair
  };

  // Renderização Condicional
  if (currentView === 'landing') {
    return <LandingPage onNavigate={handleNavigateToAuth} />;
  }

  if (currentView === 'auth') {
    return <AuthView onLogin={handleLoginSuccess} />;
  }

  if (currentView === 'reset_password') {
    return (
      <ResetPasswordView
        onDone={() => setCurrentView(currentUser ? 'dashboard' : 'auth')}
        onGoToLogin={() => {
          supabase.auth.signOut().catch(() => {});
          setCurrentUser(null);
          setCurrentView('auth');
        }}
      />
    );
  }

  if (currentView === 'dashboard' && currentUser) {
    return <Dashboard currentUser={currentUser} onLogout={handleLogout} />;
  }

  return <div className="bg-black min-h-screen"></div>;
}
