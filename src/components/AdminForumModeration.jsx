import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, RotateCcw, Search, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export function AdminForumModeration({ t, triggerNotification }) {
  const [tab, setTab] = useState('comments');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reasonById, setReasonById] = useState({});

  const loadComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_forum_list_comments', {
        p_limit: 80,
        p_query: query
      });
      if (error) {
        triggerNotification?.(t?.adminTabForum || 'Fórum', error.message || 'Falha ao carregar', 'error');
        return;
      }
      setRows(Array.isArray(data?.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_forum_list_reports', {
        p_limit: 120,
        p_query: query
      });
      if (error) {
        triggerNotification?.(t?.adminTabForum || 'Fórum', error.message || 'Falha ao carregar', 'error');
        return;
      }
      setReports(Array.isArray(data?.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (tab === 'reports') return loadReports();
    return loadComments();
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const h = setTimeout(() => refresh(), 350);
    return () => clearTimeout(h);
  }, [query, tab]);

  const hide = async (id) => {
    const reason = String(reasonById[id] || '').trim() || null;
    const { error } = await supabase.rpc('admin_forum_hide_comment', {
      p_comment_id: id,
      p_reason: reason
    });
    if (error) {
      triggerNotification?.(t?.adminTabForum || 'Fórum', error.message || 'Falha ao bloquear', 'error');
      return;
    }
    triggerNotification?.(t?.adminTabForum || 'Fórum', t?.forumAdminUpdated || 'Atualizado.', 'success');
    await refresh();
  };

  const unhide = async (id) => {
    const { error } = await supabase.rpc('admin_forum_unhide_comment', { p_comment_id: id });
    if (error) {
      triggerNotification?.(t?.adminTabForum || 'Fórum', error.message || 'Falha ao desbloquear', 'error');
      return;
    }
    triggerNotification?.(t?.adminTabForum || 'Fórum', t?.forumAdminUpdated || 'Atualizado.', 'success');
    await refresh();
  };

  const del = async (id) => {
    const { error } = await supabase.rpc('admin_forum_delete_comment', { p_comment_id: id });
    if (error) {
      triggerNotification?.(t?.adminTabForum || 'Fórum', error.message || 'Falha ao apagar', 'error');
      return;
    }
    triggerNotification?.(t?.adminTabForum || 'Fórum', t?.forumAdminUpdated || 'Atualizado.', 'success');
    await refresh();
  };

  const setResolved = async (reportId, resolved) => {
    const { error } = await supabase.rpc('admin_forum_set_report_resolved', {
      p_report_id: reportId,
      p_resolved: resolved
    });
    if (error) {
      triggerNotification?.(t?.adminTabForum || 'Fórum', error.message || 'Falha ao atualizar', 'error');
      return;
    }
    triggerNotification?.(t?.adminTabForum || 'Fórum', t?.forumAdminUpdated || 'Atualizado.', 'success');
    await refresh();
  };

  return (
    <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-cyan-300 font-bold tracking-wide">{t?.forumAdminModerationTitle || 'FÓRUM · MODERAÇÃO'}</p>
          <p className="text-[11px] text-gray-500">{t?.forumAdminSubtitle || 'Bloquear/Apagar comentários e gerir reports'}</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg"
        >
          {t?.adminUpdate || 'Atualizar'}
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setTab('comments')}
          className={`px-3 py-2 rounded-xl border text-xs font-bold ${
            tab === 'comments'
              ? 'bg-blue-700/30 border-blue-700/60 text-blue-100'
              : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-900'
          }`}
        >
          {t?.forumAdminTabComments || 'Comentários'}
        </button>
        <button
          onClick={() => setTab('reports')}
          className={`px-3 py-2 rounded-xl border text-xs font-bold ${
            tab === 'reports'
              ? 'bg-blue-700/30 border-blue-700/60 text-blue-100'
              : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-900'
          }`}
        >
          {t?.forumAdminTabReports || 'Reports'}
        </button>
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-2 bg-gray-950/40 border border-gray-800 rounded-xl px-3 py-2">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t?.forumAdminSearchPlaceholder || 'Buscar por usuário, tópico ou comentário'}
            className="w-full bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">
        {tab === 'comments' ? rows.map((r) => {
          const isHidden = Boolean(r.is_hidden);
          const isDeleted = Boolean(r.is_deleted);
          const reason = String(reasonById[r.id] || '');
          return (
            <div key={r.id} className="bg-gray-950/40 border border-gray-800 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white font-bold truncate">{r.topic_title || 'Tópico'}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    @{r.author_username || 'user'} · {new Date(r.created_at).toLocaleString()}
                    {isDeleted ? ' · APAGADO' : isHidden ? ' · BLOQUEADO' : ''}
                  </p>
                  <p className="text-sm text-gray-200 mt-2 whitespace-pre-wrap break-words">{r.body}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {!isDeleted ? (
                    isHidden ? (
                      <button
                        onClick={() => unhide(r.id)}
                        className="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 px-3 py-2 rounded-xl text-xs font-bold"
                        title={t?.forumAdminUnhide || 'Desbloquear'}
                      >
                        <Eye size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => hide(r.id)}
                        className="bg-yellow-700/80 hover:bg-yellow-600 border border-yellow-700 text-white px-3 py-2 rounded-xl text-xs font-bold"
                        title={t?.forumAdminHide || 'Bloquear'}
                      >
                        <EyeOff size={16} />
                      </button>
                    )
                  ) : null}
                  <button
                    onClick={() => del(r.id)}
                    className="bg-red-800 hover:bg-red-700 border border-red-700 text-white px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-60"
                    title={t?.forumAdminDelete || 'Apagar'}
                    disabled={isDeleted}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {!isHidden && !isDeleted ? (
                <div className="mt-2">
                  <input
                    value={reason}
                    onChange={(e) => setReasonById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder={t?.forumAdminReasonPlaceholder || 'Motivo (opcional)'}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-600"
                  />
                </div>
              ) : null}
            </div>
          );
        }) : reports.map((rep) => {
          const isResolved = Boolean(rep.is_resolved);
          const isHidden = Boolean(rep.comment_is_hidden);
          const isDeleted = Boolean(rep.comment_is_deleted);
          const createdAt = rep.created_at ? new Date(rep.created_at).toLocaleString() : '';
          return (
            <div key={rep.report_id} className="bg-gray-950/40 border border-gray-800 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white font-bold truncate">{rep.topic_title || 'Tópico'}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    @{rep.comment_author_username || 'user'} · report por @{rep.reporter_username || 'user'} · {createdAt}
                    {isResolved ? ' · RESOLVIDO' : ''}
                  </p>
                  <p className="text-sm text-gray-200 mt-2 whitespace-pre-wrap break-words">{rep.comment_body}</p>
                  {rep.reason ? (
                    <div className="mt-2 bg-gray-900/50 border border-gray-800 rounded-xl px-3 py-2">
                      <p className="text-[11px] text-gray-500">{t?.forumAdminReportReason || 'Motivo'}</p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{rep.reason}</p>
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => setResolved(rep.report_id, !isResolved)}
                    className="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 px-3 py-2 rounded-xl text-xs font-bold"
                    title={isResolved ? (t?.forumAdminReopen || 'Reabrir') : (t?.forumAdminResolve || 'Resolver')}
                  >
                    {isResolved ? <RotateCcw size={16} /> : <Check size={16} />}
                  </button>
                  {!isDeleted ? (
                    isHidden ? (
                      <button
                        onClick={() => unhide(rep.comment_id)}
                        className="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 px-3 py-2 rounded-xl text-xs font-bold"
                        title={t?.forumAdminUnhide || 'Desbloquear'}
                      >
                        <Eye size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => hide(rep.comment_id)}
                        className="bg-yellow-700/80 hover:bg-yellow-600 border border-yellow-700 text-white px-3 py-2 rounded-xl text-xs font-bold"
                        title={t?.forumAdminHide || 'Bloquear'}
                      >
                        <EyeOff size={16} />
                      </button>
                    )
                  ) : null}
                  <button
                    onClick={() => del(rep.comment_id)}
                    className="bg-red-800 hover:bg-red-700 border border-red-700 text-white px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-60"
                    title={t?.forumAdminDelete || 'Apagar'}
                    disabled={isDeleted}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && tab === 'comments' && !rows.length ? (
          <div className="text-xs text-gray-500">Sem itens.</div>
        ) : null}
        {!loading && tab === 'reports' && !reports.length ? (
          <div className="text-xs text-gray-500">Sem itens.</div>
        ) : null}
        {loading ? <div className="text-xs text-gray-500">Carregando...</div> : null}
      </div>
    </div>
  );
}
