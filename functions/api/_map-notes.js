// Vlastní poznámky na mapě výletu ("lilo", "idiotský kamion", "blbá pumpa"…).
// mapNotes: [{ id, icon, text, at: 'stop'|'leg', k }]  — at=stop: u zastávky k, at=leg: cestou do zastávky k (mezi k-1 a k).
export function cleanMapNotes(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).map((n, i) => ({
    id: String((n && n.id) || ('n' + i)).slice(0, 24),
    icon: String((n && n.icon) || '💬').slice(0, 8),
    text: String((n && n.text) || '').trim().slice(0, 120),
    at: n && n.at === 'leg' ? 'leg' : 'stop',
    k: Number.isInteger(n && n.k) && n.k >= 0 && n.k < 50 ? n.k : 0
  })).filter(n => n.text);
}
