export const getSupabaseEdgeBaseUrl = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;
  let cleaned = String(url ?? '').trim();
  for (;;) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    const pair =
      first === '<' ? '>' :
      first === '(' ? ')' :
      first === '"' ? '"' :
      first === "'" ? "'" :
      first === '`' ? '`' :
      null;
    if (!pair || last !== pair) break;
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned ? `${cleaned}/functions/v1` : null;
};

const extractJwt = (value) => {
  const v = String(value ?? '').trim();
  const match = v.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return match?.[0] || v;
};

export const callSupabaseEdge = async (functionName, body) => {
  const base = getSupabaseEdgeBaseUrl();
  let anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  for (;;) {
    const first = anon[0];
    const last = anon[anon.length - 1];
    const pair =
      first === '<' ? '>' :
      first === '(' ? ')' :
      first === '"' ? '"' :
      first === "'" ? "'" :
      first === '`' ? '`' :
      null;
    if (!pair || last !== pair) break;
    anon = anon.slice(1, -1).trim();
  }
  anon = extractJwt(anon);
  if (!base || !anon) return { ok: false, error: 'Missing Supabase env vars' };
  const { supabase } = await import('./supabaseClient');

  const getToken = async () => {
    const sessionRes = await supabase.auth.getSession();
    return sessionRes?.data?.session?.access_token || null;
  };

  const post = async (token) => {
    const res = await fetch(`${base}/${functionName}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body ?? {})
    });
    const raw = await res.text().catch(() => '');
    const data = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
    return { res, data, raw };
  };

  const token1 = await getToken();
  if (!token1) return { ok: false, error: 'Not authenticated' };

  const attempt1 = await post(token1);
  if (attempt1.res.ok) return { ok: true, data: attempt1.data };

  const msg = attempt1.data?.error || attempt1.res.statusText || attempt1.raw || 'Request failed';
  const hint = attempt1.res.status === 401 && String(msg || '').toLowerCase().includes('invalid jwt')
    ? 'Invalid JWT. Use Reautenticar e faça login novamente.'
    : null;
  return { ok: false, error: hint ? `${msg} (${hint})` : msg, status: attempt1.res.status };
};

export const callSupabaseEdgeAnonAuth = async (functionName, body) => {
  const base = getSupabaseEdgeBaseUrl();
  let anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  for (;;) {
    const first = anon[0];
    const last = anon[anon.length - 1];
    const pair =
      first === '<' ? '>' :
      first === '(' ? ')' :
      first === '"' ? '"' :
      first === "'" ? "'" :
      first === '`' ? '`' :
      null;
    if (!pair || last !== pair) break;
    anon = anon.slice(1, -1).trim();
  }
  anon = extractJwt(anon);
  if (!base || !anon) return { ok: false, error: 'Missing Supabase env vars' };
  const { supabase } = await import('./supabaseClient');

  const sessionRes = await supabase.auth.getSession();
  const userToken = sessionRes?.data?.session?.access_token || null;

  const res = await fetch(`${base}/${functionName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      ...(userToken ? { 'x-vdex-user-jwt': userToken } : {})
    },
    body: JSON.stringify(body ?? {})
  });
  const raw = await res.text().catch(() => '');
  const data = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
  if (res.ok) return { ok: true, data };
  const msg = data?.error || res.statusText || raw || 'Request failed';
  return { ok: false, error: msg, status: res.status };
};

export const invokeSupabaseFunction = async (functionName, body) => {
  const { supabase } = await import('./supabaseClient');
  const sessionRes = await supabase.auth.getSession();
  const token = sessionRes?.data?.session?.access_token || null;
  const headers = token ? { authorization: `Bearer ${token}` } : undefined;
  const { data, error } = await supabase.functions.invoke(functionName, { body: body ?? {}, headers });
  if (error) {
    const message = error.message || 'Request failed';
    const status = error?.context?.status || null;
    const rawBody = error?.context?.body;
    const bodyText =
      typeof rawBody === 'string'
        ? rawBody
        : (rawBody && typeof rawBody === 'object')
          ? (() => { try { return JSON.stringify(rawBody); } catch { return ''; } })()
          : '';
    const detail = bodyText ? `${message}: ${bodyText}` : message;
    return { ok: false, error: detail, status };
  }
  return { ok: true, data };
};

export const syncUser = async (user) => {
  const payload = {
    auth_user_id: null,
    email: user?.email || null,
    name: user?.name || null,
    username: user?.username || null,
    sponsor_code: user?.sponsor || user?.sponsor_code || null,
    lang: user?.lang || 'pt'
  };
  return callSupabaseEdge('api-user-sync', payload);
};

export const createContract = async ({ user, plan, amount, start_at }) => {
  const payload = {
    action: 'create',
    user_email: user?.email || null,
    plan_id: plan?.id || null,
    plan_name: plan?.name || null,
    amount: Number(amount),
    plan_duration_days: Number(plan?.duration) || null,
    plan_roi_total: Number(plan?.roiTotal) || null,
    withdraw_every_days: Number(plan?.withdrawEveryDays) || null,
    start_at: typeof start_at === 'string' && start_at.trim()
      ? start_at
      : new Date().toISOString()
  };
  return callSupabaseEdge('api-contracts', payload);
};

export const listContracts = async ({ user }) => {
  const payload = {
    action: 'list',
    user_email: user?.email || null
  };
  return callSupabaseEdge('api-contracts', payload);
};

export const saveContractRuntimeMany = async ({ user, contracts }) => {
  const payload = {
    action: 'save_runtime_many',
    user_email: user?.email || null,
    contracts: Array.isArray(contracts) ? contracts : []
  };
  return callSupabaseEdge('api-contracts', payload);
};

export const upsertBotCycles = async ({ user, cycles }) => {
  const payload = {
    action: 'upsert',
    user_email: user?.email || null,
    cycles: Array.isArray(cycles) ? cycles : []
  };
  return callSupabaseEdge('api-cycles', payload);
};

export const listBotCycles = async ({ user, contract_id, day_key, limit }) => {
  const payload = {
    action: 'list',
    user_email: user?.email || null,
    contract_id: contract_id || null,
    day_key: day_key || null,
    limit: limit || null
  };
  return callSupabaseEdge('api-cycles', payload);
};

export const adminUpdateUser = async ({ user_id, name, username, sponsor_code, lang }) => {
  const payload = {
    action: 'update_user',
    user_id,
    name,
    username,
    sponsor_code,
    lang
  };
  return callSupabaseEdgeAnonAuth('api-admin', payload);
};

export const adminSendPasswordReset = async ({ user_id, redirect_to }) => {
  const payload = {
    action: 'send_password_reset',
    user_id,
    redirect_to: redirect_to || null
  };
  return callSupabaseEdgeAnonAuth('api-admin', payload);
};

export const adminSetUserBlocked = async ({ user_id, blocked, reason }) => {
  const payload = {
    action: 'set_user_blocked',
    user_id,
    blocked: Boolean(blocked),
    reason: reason || null
  };
  return callSupabaseEdgeAnonAuth('api-admin', payload);
};

export const adminDeleteUser = async ({ user_id }) => {
  const payload = {
    action: 'delete_user',
    user_id
  };
  return callSupabaseEdgeAnonAuth('api-admin', payload);
};

export const nowPaymentsHealth = async () => {
  return callSupabaseEdgeAnonAuth('api-nowpayments', { action: 'health' });
};

export const nowPaymentsCreatePayment = async ({ price_amount, pay_currency, deposit_asset = 'usdt', price_currency = 'usd', order_description = null }) => {
  return callSupabaseEdgeAnonAuth('api-nowpayments', {
    action: 'create_payment',
    price_amount: Number(price_amount),
    pay_currency: pay_currency || null,
    deposit_asset: deposit_asset || 'usdt',
    price_currency: price_currency || 'usd',
    order_description: order_description || null
  });
};

export const nowPaymentsMinAmount = async ({ pay_currency, fiat_equivalent = 'usd' }) => {
  return callSupabaseEdgeAnonAuth('api-nowpayments', {
    action: 'min_amount',
    pay_currency: String(pay_currency || '').toLowerCase(),
    fiat_equivalent: String(fiat_equivalent || 'usd').toLowerCase()
  });
};

export const nowPaymentsSyncPayment = async ({ payment_id = null, order_id = null }) => {
  return callSupabaseEdgeAnonAuth('api-nowpayments', {
    action: 'sync_payment',
    payment_id: payment_id ?? null,
    order_id: order_id ?? null
  });
};

export const nowPaymentsSyncMyOrder = async ({ payment_id = null, order_id = null }) => {
  return callSupabaseEdgeAnonAuth('api-nowpayments', {
    action: 'sync_my_order',
    payment_id: payment_id ?? null,
    order_id: order_id ?? null
  });
};

export const nowPaymentsIpnSelftest = async () => {
  return callSupabaseEdgeAnonAuth('api-nowpayments', { action: 'ipn_selftest' });
};
