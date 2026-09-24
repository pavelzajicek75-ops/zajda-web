// functions/api/sections/list.js
//
// Veřejné (bez auth) — homepage si tohle tahá pro každého návštěvníka,
// stejně jako /api/subsections/by-section.

import { loadSections } from './_shared.js';

export async function onRequestGet(context) {
  const { env } = context;
  const sections = await loadSections(env);
  return Response.json(sections);
}
