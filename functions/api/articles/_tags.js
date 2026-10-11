// Štítky článku: max 8, každý max 30 znaků, bez #, bez duplicit (bez ohledu na velikost písmen).
export function normTags(input) {
  const raw = Array.isArray(input) ? input : String(input == null ? '' : input).split(',');
  const out = [], seen = new Set();
  for (let t of raw) {
    t = String(t == null ? '' : t).replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!t) continue;
    const k = t.toLocaleLowerCase('cs');
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}
