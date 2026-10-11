// Odkud čtenář přišel: z ?utm_source (odkazy ze sdílecích tlačítek) nebo z Referer.
// Vrací krátký štítek, např. „Google“, „WhatsApp“, „Přímý odkaz“. Nic osobního se neukládá.
const HOSTS = [
  [/(^|\.)google\./, 'Google'], [/(^|\.)seznam\.cz$/, 'Seznam'], [/(^|\.)bing\.com$/, 'Bing'], [/duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|l\.facebook\.com|lm\.facebook\.com)$/, 'Facebook'], [/messenger\.com$/, 'Messenger'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'], [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X / Twitter'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'], [/(^|\.)reddit\.com$/, 'Reddit']
];
const UTM = { whatsapp: 'WhatsApp', messenger: 'Messenger', facebook: 'Facebook', instagram: 'Instagram', twitter: 'X / Twitter', x: 'X / Twitter', pwa: 'Aplikace (PWA)' };

export function refLabel(raw, ownHost) {
  const s = String(raw == null ? '' : raw).trim().slice(0, 300);
  if (!s) return 'Přímý odkaz';
  if (s.startsWith('utm:')) {
    const k = s.slice(4).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    return k ? (UTM[k] || k) : 'Přímý odkaz';
  }
  let host = '';
  try { host = new URL(s).hostname.toLowerCase().replace(/^www\./, ''); } catch { return 'Přímý odkaz'; }
  if (!host) return 'Přímý odkaz';
  if (ownHost && (host === ownHost || host === String(ownHost).replace(/^www\./, ''))) return 'Z webu';
  for (const [re, label] of HOSTS) if (re.test(host)) return label;
  return host.slice(0, 40);
}

// Přičte zdroj do mapy {štítek: počet}; drží max 12 štítků (nejméně častý jiný vypadne).
export function addRef(map, label) {
  const out = { ...(map || {}) };
  out[label] = (out[label] || 0) + 1;
  const keys = Object.keys(out);
  if (keys.length > 12) {
    const victim = keys.filter(k => k !== label).sort((a, b) => out[a] - out[b])[0];
    delete out[victim];
  }
  return out;
}
