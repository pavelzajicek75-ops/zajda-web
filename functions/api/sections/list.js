// functions/api/sections/list.js
//
// Veřejné (bez auth) — homepage si tohle tahá pro každého návštěvníka,
// stejně jako /api/subsections/by-section.

import { loadSections } from './_shared.js';
import { jsonCached } from '../_auth-utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const sections = await loadSections(env);
  // Sekce se mění jen zřídka — 60s cache na edge pro běžné návštěvníky,
  // admin (posílá Authorization) má vždy čerstvá data. Viz _auth-utils.js.
  return jsonCached(sections, request, 60);
}
