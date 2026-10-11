export const SITE_KEY = 'meta:site';

export async function loadSite(env) {
  const v = await env.ARTICLES.get(SITE_KEY, { type: 'json' });
  const s = (v && typeof v === 'object') ? v : {};
  return {
    status: s.status && s.status.text ? s.status : null,
    messagesEnabled: s.messagesEnabled === true,
    follow: s.follow && typeof s.follow === 'object' ? s.follow : {}
  };
}

export function cleanText(str, max) {
  return String(str == null ? '' : str).replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Jen https:// odkazy; vše ostatní se zahodí.
export function cleanUrl(str) {
  const s = String(str == null ? '' : str).trim().slice(0, 300);
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
}
