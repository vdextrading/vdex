export const GLOBAL_ANNOUNCEMENTS = [
  {
    id: '2026-06-operational-pause-v1',
    enabled: true,
    priority: 100,
    badgeKey: 'globalNoticeBadge',
    titleKey: 'globalNoticeTitle',
    openKey: 'globalNoticeOpen',
    closeKey: 'globalNoticeClose',
    bodyKeys: ['globalNoticeBody1', 'globalNoticeBody2']
  }
];

export const getActiveGlobalAnnouncement = (announcements = GLOBAL_ANNOUNCEMENTS) => {
  const items = Array.isArray(announcements) ? announcements.filter((item) => item?.enabled) : [];
  if (!items.length) return null;
  return items
    .slice()
    .sort((a, b) => {
      const pa = Number(a?.priority) || 0;
      const pb = Number(b?.priority) || 0;
      return pb - pa;
    })[0];
};

export const getGlobalAnnouncementStorageKey = (userLike, announcement) => {
  const identity = String(userLike?.email || userLike?.id || '').trim().toLowerCase();
  const announcementId = String(announcement?.id || '').trim();
  if (!identity || !announcementId) return null;
  return `vdex_global_notice_${announcementId}_${identity}`;
};
