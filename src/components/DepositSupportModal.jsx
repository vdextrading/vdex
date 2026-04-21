import React, { useMemo, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const sanitizeFilename = (name) => {
  const raw = String(name || '').trim() || 'file';
  return raw.replace(/[^\w.\-]+/g, '_').slice(0, 120);
};

const buildTicketSubject = (t, nowPayData) => {
  const orderId = String(nowPayData?.order_id || '').trim();
  const paymentId = String(nowPayData?.payment_id || '').trim();
  const currency = String(nowPayData?.pay_currency || '').trim();
  const idPart = orderId ? `Order ${orderId}` : paymentId ? `Payment ${paymentId}` : (currency ? currency : 'NOWPayments');
  return (t?.depositSupportSubjectPrefix || 'Deposit pending') + ` · ${idPart}`;
};

export function DepositSupportModal({ open, onClose, nowPayData, t, triggerNotification, onCreated }) {
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const subject = useMemo(() => buildTicketSubject(t, nowPayData), [t, nowPayData?.order_id, nowPayData?.payment_id, nowPayData?.pay_currency]);

  const canSubmit = Boolean(nowPayData) && !loading;

  if (!open) return null;

  const handleClose = () => {
    if (loading) return;
    setMessage('');
    setTxHash('');
    setFile(null);
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!nowPayData) return;
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('support_create_deposit_ticket', {
        p_order_id: String(nowPayData?.order_id || '').trim(),
        p_message: String(message || '').trim() || null,
        p_tx_hash: String(txHash || '').trim() || null
      });

      if (error) {
        triggerNotification?.(t?.support || 'Support', error.message || 'Failed to open ticket', 'error');
        return;
      }

      const ticketId = data?.ticket_id || null;
      const messageId = data?.message_id || null;

      if (!ticketId) {
        triggerNotification?.(t?.support || 'Support', 'Invalid response from server', 'error');
        return;
      }

      if (file && messageId) {
        const sessionRes = await supabase.auth.getSession();
        const authUid = sessionRes?.data?.session?.user?.id || null;
        if (!authUid) {
          triggerNotification?.(t?.support || 'Support', 'Not authenticated', 'error');
          triggerNotification?.(t?.support || 'Support', t?.depositSupportTicketOpened || 'Ticket opened. Our team will review it.', 'success');
          onCreated?.(ticketId);
          handleClose();
          return;
        }
        const safeName = sanitizeFilename(file.name);
        const path = `${authUid}/${ticketId}/${Date.now()}_${safeName}`;
        const upRes = await supabase.storage.from('support-proofs').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined
        });
        if (upRes.error) {
          triggerNotification?.(t?.support || 'Support', upRes.error.message || 'Upload failed', 'error');
          triggerNotification?.(t?.support || 'Support', t?.depositSupportTicketOpened || 'Ticket opened. Our team will review it.', 'success');
          onCreated?.(ticketId);
          handleClose();
          return;
        }
        const attachRes = await supabase.rpc('support_attach_file', {
          ticket_id: ticketId,
          message_id: messageId,
          storage_path: path,
          original_name: safeName,
          mime: file.type || null,
          size_bytes: Number(file.size) || null
        });
        if (attachRes.error) {
          triggerNotification?.(t?.support || 'Support', attachRes.error.message || 'Failed to attach file', 'error');
          triggerNotification?.(t?.support || 'Support', t?.depositSupportTicketOpened || 'Ticket opened. Our team will review it.', 'success');
          onCreated?.(ticketId);
          handleClose();
          return;
        }
      }

      triggerNotification?.(t?.support || 'Support', t?.depositSupportTicketOpened || 'Ticket opened. Our team will review it.', 'success');
      onCreated?.(ticketId);
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/70" onClick={handleClose}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-gray-950/95 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-blue-300 font-bold tracking-wide">{t?.depositSupportTitle || 'Deposit support'}</p>
              <p className="text-white font-black text-lg mt-1">{t?.depositSupportSubtitle || 'Send proof and open a ticket'}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {t?.depositSupportHint || 'If your deposit is taking too long, attach a screenshot/receipt and provide the transaction hash (if available).'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 bg-gray-900/60 hover:bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-xs"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{t?.depositSupportSubject || 'Subject'}</p>
            <p className="text-white text-sm font-semibold mt-1 break-words">{subject}</p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <div>
              <label className="text-[11px] text-gray-400">{t?.depositSupportMessage || 'Message (optional)'}</label>
              <textarea
                className="w-full mt-1 min-h-[90px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t?.depositSupportMessagePlaceholder || 'Describe what happened...'}
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400">{t?.depositSupportTx || 'Transaction hash (optional)'}</label>
              <input
                className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder={t?.depositSupportTxPlaceholder || '0x... / TXID...'}
                disabled={loading}
              />
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400">{t?.depositSupportAttach || 'Attachment (optional)'}</p>
                  <p className="text-[11px] text-gray-500 break-all">
                    {file ? `${file.name} (${Math.round((file.size || 0) / 1024)} KB)` : (t?.depositSupportAttachHint || 'PNG/JPG/PDF up to 5MB')}
                  </p>
                </div>
                <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 text-white font-bold px-3 py-2 rounded-lg text-xs inline-flex items-center gap-2">
                  <Paperclip size={14} />
                  {t?.depositSupportChooseFile || 'Choose file'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (!f) return;
                      if ((f.size || 0) > 5 * 1024 * 1024) {
                        triggerNotification?.(t?.support || 'Support', t?.depositSupportFileTooLarge || 'File too large (max 5MB).', 'error');
                        e.target.value = '';
                        return;
                      }
                      setFile(f);
                    }}
                    disabled={loading}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold px-4 py-2 rounded-lg text-xs"
            >
              {loading ? (t?.depositSupportSending || 'Sending...') : (t?.depositSupportOpenTicket || 'Open ticket')}
            </button>
            <button
              onClick={handleClose}
              disabled={loading}
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-lg text-xs"
            >
              {t?.depositSupportCancel || 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
