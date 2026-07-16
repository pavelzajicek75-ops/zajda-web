// functions/api/data/folders.js
//
// GET  /api/data/folders  → { photoFolderMap, manualFolders, updated }
// POST /api/data/folders  body: { photoFolderMap, manualFolders }
//
// Řeší přesně tohle: na PC klikneš "Uložit na server", data se zapíšou
// do KV. Na jiném zařízení klikneš "Načíst ze serveru" a stáhnou se
// stejná data. Až skončíš práci na tom zařízení, zase "Uložit" a starý
// záznam se přepíše novým. Žádné soubory v repu, žádné ruční kopírování.
//
// Potřebuješ KV namespace (stejný princip jako u ADMIN_USERS) — klidně
// ho pojmenuj APP_DATA a přidej v Cloudflare Pages → Settings →
// Functions → KV namespace bindings.
//
// TODO: requireAuth() — nahraď skutečným ověřením (viz _auth-utils.js
// z admin/usage.js — pokud jsi ho už přidal/a, stačí sem naimportovat
// stejnou funkci `requireAuth` místo tohohle placeholderu).

async function requireAuth(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.includes('admin_token=');
}

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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
