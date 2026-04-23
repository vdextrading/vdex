import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Flag, MessageSquare, Minus, Plus, Search, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const toText = (v) => String(v ?? '');

const initialsFrom = (username, name) => {
  const raw = (toText(name).trim() || toText(username).trim() || '?').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '?';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : (raw[1] || '');
  return (a + b).toUpperCase();
};

const formatAgo = (dateLike, t) => {
  const d = dateLike ? new Date(dateLike) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins <= 0) return 'agora';
  if (mins < 60) return `${mins} min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days} d atrás`;
};

function CreateTopicModal({ open, t, onClose, onCreated, triggerNotification }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
  }, [open]);

  if (!open) return null;

  const canSubmit = !loading && title.trim().length >= 3 && body.trim().length >= 3;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('forum_create_topic', {
        p_title: title,
        p_body: body
      });
      if (error) {
        triggerNotification?.(t?.forum || 'Forum', error.message || 'Falha ao criar tópico', 'error');
        return;
      }
      const topicId = data?.topic_id || null;
      if (!topicId) {
        triggerNotification?.(t?.forum || 'Forum', 'Resposta inválida do servidor', 'error');
        return;
      }
      onCreated?.(topicId);
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/70" onClick={() => (loading ? null : onClose?.())}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-gray-950/95 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white font-black text-lg">{t?.forumCreateTopic || 'Criar Tópico'}</p>
            </div>
            <button
              onClick={() => (loading ? null : onClose?.())}
              className="w-9 h-9 flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t?.forumTopicTitlePlaceholder || 'Título do tópico...'}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-600"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t?.forumTopicBodyPlaceholder || 'Partilha a tua estratégia ou dúvida...'}
              rows={8}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => (loading ? null : onClose?.())}
              className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 font-bold py-3 rounded-xl"
              disabled={loading}
            >
              {t?.forumCancel || 'Cancelar'}
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-60 text-white font-black py-3 rounded-xl"
              disabled={!canSubmit}
            >
              {loading ? '...' : (t?.forumPublish || 'PUBLICAR')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DmModal({ open, t, other, onClose, triggerNotification }) {
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [msg, setMsg] = useState('');
  const [myUserId, setMyUserId] = useState(null);
  const listRef = useRef(null);
  const autoScrollRef = useRef(false);
  const pendingScrollAdjustRef = useRef(null);

  const otherId = other?.id || null;
  const otherName = other?.username || other?.name || '';
  const otherAvatar = initialsFrom(other?.username, other?.name);
  const myAvatar = initialsFrom('Você', '');

  const loadThread = async ({ tid, before, mode }) => {
    const { data, error } = await supabase.rpc('forum_dm_get_thread', {
      p_thread_id: tid,
      p_limit: 120,
      p_before: before ?? null
    });
    if (error) return { ok: false, error: error.message };
    const items = Array.isArray(data?.messages) ? data.messages : [];
    const more = Boolean(data?.messages_has_more);
    const next = data?.messages_next_before || null;
    setHasMore(more);
    setNextBefore(next);
    setMessages((prev) => {
      if (mode === 'prepend') {
        const seen = new Set(prev.map((x) => x.id));
        const add = items.filter((x) => !seen.has(x.id));
        return add.concat(prev);
      }
      return items;
    });
    return { ok: true };
  };

  useEffect(() => {
    if (!open || !otherId) return;
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const meRes = await supabase.rpc('forum_get_current_user_id');
        if (!cancelled && !meRes.error) setMyUserId(meRes.data || null);
        const openThread = async (recipientId) => {
          const { data, error } = await supabase.rpc('forum_dm_get_or_create_thread', { p_other_user_id: recipientId });
          return { data, error };
        };
        let { data, error } = await openThread(otherId);
        if (error) {
          const msgText = String(error.message || '').toLowerCase();
          const canRetry =
            (msgText.includes('invalid recipient') || msgText.includes('recipient not found'))
            && String(other?.username || '').trim().length > 0;
          if (canRetry) {
            const lookup = await supabase.rpc('forum_find_user', { p_username: String(other.username).trim() });
            const resolvedId = lookup?.data?.id || null;
            if (!lookup.error && resolvedId) {
              ({ data, error } = await openThread(resolvedId));
            }
          }
        }
        if (cancelled) return;
        if (error) {
          triggerNotification?.(t?.forumDm || 'DM', error.message || 'Falha ao abrir conversa', 'error');
          return;
        }
        const tid = data?.thread_id || null;
        setThreadId(tid);
        if (!tid) {
          triggerNotification?.(t?.forumDm || 'DM', 'Resposta inválida do servidor', 'error');
          return;
        }
        autoScrollRef.current = true;
        const res = await loadThread({ tid, before: null, mode: 'reset' });
        if (!res.ok) triggerNotification?.(t?.forumDm || 'DM', res.error || 'Falha ao carregar mensagens', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [open, otherId]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const pending = pendingScrollAdjustRef.current;
    if (pending) {
      const nextHeight = el.scrollHeight;
      const delta = nextHeight - pending.prevHeight;
      el.scrollTop = pending.prevTop + delta;
      pendingScrollAdjustRef.current = null;
      return;
    }
    if (autoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
      autoScrollRef.current = false;
    }
  }, [open, messages.length]);

  if (!open) return null;

  const canSend = !loading && threadId && msg.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    const body = msg.trim();
    setMsg('');
    const { error } = await supabase.rpc('forum_dm_send', { p_thread_id: threadId, p_body: body });
    if (error) {
      triggerNotification?.(t?.forumDm || 'DM', error.message || 'Falha ao enviar', 'error');
      setMsg(body);
      return;
    }
    autoScrollRef.current = true;
    await loadThread({ tid: threadId, before: null, mode: 'reset' });
  };

  const handleLoadOlder = async () => {
    if (!threadId || !hasMore || !nextBefore || loadingOlder) return;
    const el = listRef.current;
    if (el) pendingScrollAdjustRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop };
    try {
      setLoadingOlder(true);
      const res = await loadThread({ tid: threadId, before: nextBefore, mode: 'prepend' });
      if (!res.ok) triggerNotification?.(t?.forumDm || 'DM', res.error || 'Falha ao carregar mensagens', 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/70" onClick={() => (loading ? null : onClose?.())}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-gray-950/95 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-black text-gray-200">
                {otherAvatar}
              </div>
              <p className="text-white font-black text-lg truncate">{otherName || (t?.forumDm || 'Mensagem direta')}</p>
            </div>
            <button
              onClick={() => (loading ? null : onClose?.())}
              className="w-9 h-9 flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={listRef} className="p-4 max-h-[55vh] overflow-y-auto custom-scrollbar space-y-2">
            {hasMore ? (
              <button
                onClick={handleLoadOlder}
                disabled={loadingOlder || loading}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-60 border border-gray-800 text-gray-200 font-bold py-2 rounded-xl text-sm"
              >
                {loadingOlder ? '...' : (t?.forumLoadOlderMessages || 'Carregar mensagens anteriores')}
              </button>
            ) : null}
            {messages.map((m) => (
              (() => {
                const isMine = m.sender_user_id && myUserId && m.sender_user_id === myUserId;
                const who = isMine ? 'Você' : (otherName || 'User');
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {!isMine ? (
                      <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-black text-[11px] text-gray-200">
                        {otherAvatar}
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[78%] border rounded-2xl px-4 py-3 ${
                        isMine
                          ? 'bg-blue-700/35 border-blue-700/60 text-gray-100'
                          : 'bg-gray-900/60 border-gray-800 text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-gray-400 truncate">{who}</p>
                        <p className="text-[11px] text-gray-500 shrink-0">{formatAgo(m.created_at, t)}</p>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                    {isMine ? (
                      <div className="w-8 h-8 rounded-full bg-blue-700/40 border border-blue-700/60 flex items-center justify-center font-black text-[11px] text-blue-100">
                        {myAvatar}
                      </div>
                    ) : null}
                  </div>
                );
              })()
            ))}
            {!messages.length && (
              <div className="text-xs text-gray-500">{loading ? '...' : 'Sem mensagens ainda.'}</div>
            )}
          </div>

          <div className="p-4 border-t border-gray-800 flex gap-2">
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={t?.forumDmPlaceholder || 'Escreva uma mensagem...'}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-600"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold px-4 rounded-xl"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportCommentModal({ open, t, comment, onClose, triggerNotification }) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
  }, [open, comment?.id]);

  if (!open) return null;

  const commentId = comment?.id || null;
  const canSubmit = !loading && commentId;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc('forum_report_comment', {
        p_comment_id: commentId,
        p_reason: reason
      });
      if (error) {
        const msg = String(error.message || '');
        triggerNotification?.(t?.forum || 'Fórum', msg.includes('RATE_LIMIT') ? (t?.forumRateLimit || 'Muitas denúncias em pouco tempo. Tente novamente em 1 minuto.') : (msg || 'Falha ao reportar'), 'error');
        return;
      }
      triggerNotification?.(t?.forum || 'Fórum', t?.forumReportSent || 'Report enviado.', 'success');
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/70" onClick={() => (loading ? null : onClose?.())}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-gray-950/95 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white font-black text-lg">{t?.forumReportTitle || 'Reportar comentário'}</p>
              <p className="text-[11px] text-gray-500 truncate">
                @{comment?.author_username || comment?.author_name || 'user'}
              </p>
            </div>
            <button
              onClick={() => (loading ? null : onClose?.())}
              className="w-9 h-9 flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 bg-gray-900/50 border border-gray-800 rounded-xl p-3">
            <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">
              {comment?.body || ''}
            </p>
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t?.forumReportPlaceholder || 'Motivo (opcional)'}
            rows={4}
            className="mt-3 w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-600 resize-none"
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => (loading ? null : onClose?.())}
              className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 font-bold py-3 rounded-xl"
              disabled={loading}
            >
              {t?.forumCancel || 'Cancelar'}
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-red-800 hover:bg-red-700 disabled:opacity-60 text-white font-black py-3 rounded-xl"
              disabled={!canSubmit}
            >
              {loading ? '...' : (t?.forumReportSend || 'REPORTAR')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForumView({ t, triggerNotification }) {
  const [query, setQuery] = useState('');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadingOlderComments, setLoadingOlderComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [dmOther, setDmOther] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  const sentinelRef = useRef(null);
  const inflightTopicsRef = useRef(false);

  const selectedTopic = detail?.topic || null;
  const comments = Array.isArray(detail?.comments) ? detail.comments : [];
  const commentsHasMore = Boolean(detail?.comments_has_more);
  const commentsNextBefore = detail?.comments_next_before || null;

  const loadTopics = useCallback(async ({ reset } = {}) => {
    const PAGE_SIZE = 30;
    if (inflightTopicsRef.current) return;
    if (!reset && (!hasMore || loadingMore || loading)) return;
    try {
      inflightTopicsRef.current = true;
      if (reset) {
        setLoading(true);
        setLoadingMore(false);
        setHasMore(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const requestOffset = reset ? 0 : offset;
      const { data, error } = await supabase.rpc('forum_list_topics', {
        p_limit: PAGE_SIZE,
        p_offset: requestOffset,
        p_query: query
      });
      if (error) {
        triggerNotification?.(t?.forum || 'Fórum', error.message || 'Falha ao carregar tópicos', 'error');
        return;
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      setTopics((prev) => {
        if (reset) return items;
        const seen = new Set(prev.map((x) => x.id));
        const add = items.filter((x) => !seen.has(x.id));
        return prev.concat(add);
      });
      setOffset(requestOffset + items.length);
      setHasMore(items.length === PAGE_SIZE);
    } finally {
      inflightTopicsRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, offset, query, t?.forum, triggerNotification]);

  const loadDetail = async (id) => {
    if (!id) return;
    try {
      setDetailLoading(true);
      const { data, error } = await supabase.rpc('forum_get_topic', {
        p_topic_id: id,
        p_comments_limit: 80,
        p_comments_before: null
      });
      if (error) {
        triggerNotification?.(t?.forum || 'Fórum', error.message || 'Falha ao carregar tópico', 'error');
        return;
      }
      setDetail(data || null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadTopics({ reset: true });
  }, []);

  useEffect(() => {
    const h = setTimeout(() => loadTopics({ reset: true }), 350);
    return () => clearTimeout(h);
  }, [query]);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) return;
    const el = sentinelRef.current;
    if (!el) return;
    if (!hasMore || loading || loadingMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadTopics({ reset: false });
      },
      { root: null, rootMargin: '240px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, loadTopics, selectedId]);

  const toggleReaction = async ({ kind, id, current, next }) => {
    if (!id) return;
    const value = current === next ? 0 : next;
    const fn = kind === 'topic' ? 'forum_set_topic_reaction' : 'forum_set_comment_reaction';
    const payload = kind === 'topic'
      ? { p_topic_id: id, p_value: value }
      : { p_comment_id: id, p_value: value };

    const { error } = await supabase.rpc(fn, payload);
    if (error) {
      triggerNotification?.(t?.forum || 'Fórum', error.message || 'Falha ao reagir', 'error');
      return;
    }
    if (kind === 'topic') {
      setTopics((prev) => prev.map((it) => {
        if (it.id !== id) return it;
        const old = Number(it.my_reaction) || 0;
        const likes = Number(it.like_count) || 0;
        const dislikes = Number(it.dislike_count) || 0;
        const nextLikes = likes + (old === 1 ? -1 : 0) + (value === 1 ? 1 : 0);
        const nextDislikes = dislikes + (old === -1 ? -1 : 0) + (value === -1 ? 1 : 0);
        return { ...it, my_reaction: value, like_count: nextLikes, dislike_count: nextDislikes };
      }));
      setDetail((prev) => {
        if (!prev?.topic || prev.topic.id !== id) return prev;
        const old = Number(prev.topic.my_reaction) || 0;
        const likes = Number(prev.topic.like_count) || 0;
        const dislikes = Number(prev.topic.dislike_count) || 0;
        const nextLikes = likes + (old === 1 ? -1 : 0) + (value === 1 ? 1 : 0);
        const nextDislikes = dislikes + (old === -1 ? -1 : 0) + (value === -1 ? 1 : 0);
        return { ...prev, topic: { ...prev.topic, my_reaction: value, like_count: nextLikes, dislike_count: nextDislikes } };
      });
    } else if (selectedId) {
      setDetail((prev) => {
        if (!prev?.comments?.length) return prev;
        const nextComments = prev.comments.map((c) => {
          if (c.id !== id) return c;
          const old = Number(c.my_reaction) || 0;
          const likes = Number(c.like_count) || 0;
          const dislikes = Number(c.dislike_count) || 0;
          const nextLikes = likes + (old === 1 ? -1 : 0) + (value === 1 ? 1 : 0);
          const nextDislikes = dislikes + (old === -1 ? -1 : 0) + (value === -1 ? 1 : 0);
          return { ...c, my_reaction: value, like_count: nextLikes, dislike_count: nextDislikes };
        });
        return { ...prev, comments: nextComments };
      });
    }
  };

  const handleAddComment = async () => {
    if (!selectedId) return;
    const body = newComment.trim();
    if (!body) return;
    setNewComment('');
    const { error } = await supabase.rpc('forum_add_comment', {
      p_topic_id: selectedId,
      p_body: body
    });
    if (error) {
      triggerNotification?.(t?.forum || 'Fórum', error.message || 'Falha ao comentar', 'error');
      setNewComment(body);
      return;
    }
    await loadDetail(selectedId);
    setTopics((prev) => {
      const nowIso = new Date().toISOString();
      const next = prev.map((it) => {
        if (it.id !== selectedId) return it;
        const count = Number(it.comment_count) || 0;
        return { ...it, comment_count: count + 1, last_activity_at: nowIso };
      });
      return next.sort((a, b) => {
        const at = new Date(a.last_activity_at || a.created_at || 0).getTime();
        const bt = new Date(b.last_activity_at || b.created_at || 0).getTime();
        return bt - at;
      });
    });
  };

  const handleLoadOlderComments = async () => {
    if (!selectedId || !commentsHasMore || !commentsNextBefore || loadingOlderComments) return;
    try {
      setLoadingOlderComments(true);
      const { data, error } = await supabase.rpc('forum_get_topic', {
        p_topic_id: selectedId,
        p_comments_limit: 80,
        p_comments_before: commentsNextBefore
      });
      if (error) {
        triggerNotification?.(t?.forum || 'Fórum', error.message || 'Falha ao carregar comentários', 'error');
        return;
      }
      const incoming = Array.isArray(data?.comments) ? data.comments : [];
      setDetail((prev) => {
        const prevComments = Array.isArray(prev?.comments) ? prev.comments : [];
        const seen = new Set(prevComments.map((x) => x.id));
        const add = incoming.filter((x) => !seen.has(x.id));
        return {
          ...(prev || {}),
          ...(data || {}),
          comments: add.concat(prevComments)
        };
      });
    } finally {
      setLoadingOlderComments(false);
    }
  };

  const openDmWith = (u) => {
    const otherUserId = u?.user_id || u?.id || null;
    if (!otherUserId) return;
    setDmOther({ id: otherUserId, username: u.author_username || u.username || '', name: u.author_name || u.name || '' });
    setDmOpen(true);
  };

  const ListView = () => (
    <div className="px-4 pb-24 pt-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-white">{t?.forumCommunityTitle || 'FÓRUM DA COMUNIDADE'}</h2>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-purple-700 hover:bg-purple-600 text-white font-black px-4 py-3 rounded-xl flex items-center gap-2"
        >
          <Plus size={18} />
          {t?.forumNewTopic || 'Novo Tópico'}
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-2">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        {topics.map((it) => {
          const likes = Number(it.like_count) || 0;
          const dislikes = Number(it.dislike_count) || 0;
          const commentsCount = Number(it.comment_count) || 0;
          const my = Number(it.my_reaction) || 0;
          const avatar = initialsFrom(it.author_username, it.author_name);
          return (
            <div key={it.id} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => setSelectedId(it.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-black text-gray-200">
                      {avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-200 font-bold truncate">{it.author_username || it.author_name || 'user'}</p>
                      <p className="text-[11px] text-gray-500">{formatAgo(it.created_at, t)}</p>
                    </div>
                  </div>
                  <p className="text-white font-black text-lg mt-3 break-words">{it.title}</p>
                  <p className="text-gray-300 text-sm mt-1 break-words line-clamp-2">{it.body}</p>
                </button>

                <button
                  onClick={() => openDmWith(it)}
                  className="shrink-0 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 px-3 py-2 rounded-xl"
                  title={t?.forumDm || 'Mensagem direta'}
                >
                  <MessageSquare size={18} />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleReaction({ kind: 'topic', id: it.id, current: my, next: 1 })}
                    className={`px-3 py-2 rounded-xl border ${my === 1 ? 'bg-green-900/40 border-green-700 text-green-200' : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-900'}`}
                  >
                    <span className="inline-flex items-center gap-2"><Plus size={16} />{likes}</span>
                  </button>
                  <button
                    onClick={() => toggleReaction({ kind: 'topic', id: it.id, current: my, next: -1 })}
                    className={`px-3 py-2 rounded-xl border ${my === -1 ? 'bg-red-900/40 border-red-700 text-red-200' : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-900'}`}
                  >
                    <span className="inline-flex items-center gap-2"><Minus size={16} />{dislikes}</span>
                  </button>
                </div>
                <div className="text-gray-500">{commentsCount} {t?.forumComments || 'Comentários'}</div>
              </div>
            </div>
          );
        })}

        {!loading && !topics.length ? (
          <div className="text-xs text-gray-500">Nenhum tópico encontrado.</div>
        ) : null}
        {loading ? <div className="text-xs text-gray-500">Carregando...</div> : null}
        <div ref={sentinelRef}></div>
        {!loading && topics.length ? (
          loadingMore ? (
            <div className="text-xs text-gray-500">Carregando...</div>
          ) : hasMore ? (
            <button
              onClick={() => loadTopics({ reset: false })}
              className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 font-bold py-3 rounded-xl"
            >
              {t?.forumLoadMore || 'Carregar mais'}
            </button>
          ) : (
            <div className="text-xs text-gray-600 text-center">{t?.forumNoMore || 'Fim do feed.'}</div>
          )
        ) : null}
      </div>
    </div>
  );

  const DetailView = () => {
    const my = Number(selectedTopic?.my_reaction) || 0;
    const likes = Number(selectedTopic?.like_count) || 0;
    const dislikes = Number(selectedTopic?.dislike_count) || 0;
    const avatar = initialsFrom(selectedTopic?.author_username, selectedTopic?.author_name);
    return (
      <div className="px-4 pb-24 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => { setSelectedId(null); setDetail(null); }} className="text-gray-400 hover:text-white">
            <ChevronRight className="rotate-180" />
          </button>
          <h2 className="text-xl font-black text-white truncate">{t?.forumComments || 'Comentários'}</h2>
        </div>

        {detailLoading && !selectedTopic ? (
          <div className="text-xs text-gray-500">Carregando...</div>
        ) : null}

        {selectedTopic ? (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-black text-gray-200">
                  {avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-gray-200 font-bold truncate">{selectedTopic.author_username || selectedTopic.author_name || 'user'}</p>
                  <p className="text-[11px] text-gray-500">{formatAgo(selectedTopic.created_at, t)}</p>
                </div>
              </div>
              <button
                onClick={() => openDmWith({ id: selectedTopic.user_id, username: selectedTopic.author_username, name: selectedTopic.author_name })}
                className="shrink-0 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 px-3 py-2 rounded-xl"
                title={t?.forumDm || 'Mensagem direta'}
              >
                <MessageSquare size={18} />
              </button>
            </div>

            <p className="text-white font-black text-lg mt-3 break-words">{selectedTopic.title}</p>
            <p className="text-gray-200 text-sm mt-2 whitespace-pre-wrap break-words">{selectedTopic.body}</p>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => toggleReaction({ kind: 'topic', id: selectedTopic.id, current: my, next: 1 })}
                className={`px-3 py-2 rounded-xl border ${my === 1 ? 'bg-green-900/40 border-green-700 text-green-200' : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-900'}`}
              >
                <span className="inline-flex items-center gap-2"><Plus size={16} />{likes}</span>
              </button>
              <button
                onClick={() => toggleReaction({ kind: 'topic', id: selectedTopic.id, current: my, next: -1 })}
                className={`px-3 py-2 rounded-xl border ${my === -1 ? 'bg-red-900/40 border-red-700 text-red-200' : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-900'}`}
              >
                <span className="inline-flex items-center gap-2"><Minus size={16} />{dislikes}</span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {commentsHasMore ? (
            <button
              onClick={handleLoadOlderComments}
              disabled={detailLoading || loadingOlderComments}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-60 border border-gray-800 text-gray-200 font-bold py-3 rounded-xl"
            >
              {loadingOlderComments ? '...' : (t?.forumLoadOlderComments || 'Carregar comentários anteriores')}
            </button>
          ) : null}
          {comments.map((c) => {
            const cMy = Number(c.my_reaction) || 0;
            const cLikes = Number(c.like_count) || 0;
            const cDislikes = Number(c.dislike_count) || 0;
            const cAvatar = initialsFrom(c.author_username, c.author_name);
            return (
              <div key={c.id} className="bg-gray-900/40 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-black text-gray-200">
                      {cAvatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-200 font-bold truncate">{c.author_username || c.author_name || 'user'}</p>
                      <p className="text-[11px] text-gray-500">{formatAgo(c.created_at, t)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => openDmWith(c)}
                      className="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 px-3 py-2 rounded-xl"
                      title={t?.forumDm || 'Mensagem direta'}
                    >
                      <MessageSquare size={18} />
                    </button>
                    <button
                      onClick={() => { setReportTarget(c); setReportOpen(true); }}
                      className="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 px-3 py-2 rounded-xl"
                      title={t?.forumReportTitle || 'Reportar comentário'}
                    >
                      <Flag size={18} />
                    </button>
                  </div>
                </div>
                <p className="text-gray-200 text-sm mt-2 whitespace-pre-wrap break-words">{c.body}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => toggleReaction({ kind: 'comment', id: c.id, current: cMy, next: 1 })}
                    className={`px-3 py-2 rounded-xl border ${cMy === 1 ? 'bg-green-900/40 border-green-700 text-green-200' : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-900'}`}
                  >
                    <span className="inline-flex items-center gap-2"><Plus size={16} />{cLikes}</span>
                  </button>
                  <button
                    onClick={() => toggleReaction({ kind: 'comment', id: c.id, current: cMy, next: -1 })}
                    className={`px-3 py-2 rounded-xl border ${cMy === -1 ? 'bg-red-900/40 border-red-700 text-red-200' : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-900'}`}
                  >
                    <span className="inline-flex items-center gap-2"><Minus size={16} />{cDislikes}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {!detailLoading && !comments.length ? (
            <div className="text-xs text-gray-500">Sem comentários ainda.</div>
          ) : null}
        </div>

        <div className="mt-4 bg-gray-900/40 border border-gray-800 rounded-2xl p-3 flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t?.forumReplyPlaceholder || 'Escreva um comentário...'}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddComment();
              }
            }}
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim().length}
            className="bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl"
          >
            {t?.forumSend || 'Enviar'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fadeIn">
      {!selectedId ? <ListView /> : <DetailView />}
      <CreateTopicModal
        open={createOpen}
        t={t}
        onClose={() => setCreateOpen(false)}
        triggerNotification={triggerNotification}
        onCreated={(topicId) => {
          setCreateOpen(false);
          setSelectedId(topicId);
          loadTopics();
        }}
      />
      <DmModal
        open={dmOpen}
        t={t}
        other={dmOther}
        triggerNotification={triggerNotification}
        onClose={() => {
          setDmOpen(false);
          setDmOther(null);
        }}
      />
      <ReportCommentModal
        open={reportOpen}
        t={t}
        comment={reportTarget}
        triggerNotification={triggerNotification}
        onClose={() => {
          setReportOpen(false);
          setReportTarget(null);
        }}
      />
    </div>
  );
}
