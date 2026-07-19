// functions/api/data/folders.js
//
// GET  /api/data/folders  → { photoFolderMap, manualFolders, updated }
// POST /api/data/folders  body: { photoFolderMap, manualFolders }
//
// Používá KV binding APP_DATA, který už máš (klíč "folder-sync-data" —
// nekoliduje s "user:..." záznamy z admin/users.js, protože je to jiný
// prefix). Auth přes sdílenou _auth-utils.js — kdokoliv přihlášený
// (admin, editor, viewer) může synchronizovat, protože jde jen o osobní
// organizaci fotek, ne o citlivá data.

import { requireAuth, json } from '../_auth-utils.js';

const KV_KEY = 'folder-sync-data';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const raw = await env.APP_DATA.get(KV_KEY);
  if (!raw) {
    return json({ photoFolderMap: {}, manualFolders: [], updated: null });
  }
  return json(JSON.parse(raw));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Neplatný JSON' }, 400);
  }

  const payload = {
    photoFolderMap: body.photoFolderMap || {},
    manualFolders: body.manualFolders || [],
    updated: new Date().toISOString()
  };

  await env.APP_DATA.put(KV_KEY, JSON.stringify(payload));
  return json({ ok: true, updated: payload.updated });
}
