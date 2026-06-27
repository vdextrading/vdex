import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function GlobalAnnouncementModal({ announcement, t, open, onClose }) {
  if (!open || !announcement) return null;

  const badgeText = t[announcement.badgeKey] || '';
  const titleText = t[announcement.titleKey] || '';
  const closeText = t[announcement.closeKey] || 'Close';
  const bodyParts = Array.isArray(announcement.bodyKeys)
    ? announcement.bodyKeys.map((key) => String(t[key] || '').trim()).filter(Boolean)
    : [];

  return (
    <div className="absolute inset-0 z-[75]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl bg-gray-950/95 border border-yellow-500/30 rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-yellow-500/20 bg-yellow-500/10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-yellow-300 font-bold">{badgeText}</p>
              <h3 className="text-white text-xl font-black mt-1">{titleText}</h3>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-10 h-10 rounded-full border border-gray-700 bg-gray-900/80 text-gray-300 hover:text-white hover:bg-gray-800 transition flex items-center justify-center"
              aria-label={closeText}
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/20 bg-gray-900/70 p-4">
              <div className="mt-0.5 w-10 h-10 rounded-full bg-yellow-500/15 border border-yellow-500/20 text-yellow-300 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-4">
                {bodyParts.map((part, index) => (
                  <p key={`${announcement.id}_${index}`} className="text-sm leading-7 text-gray-200 whitespace-pre-line">
                    {part}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-5 py-3 rounded-xl transition"
              >
                {closeText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
