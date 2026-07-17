// functions/api/admin/users.js
//
// GET    /api/admin/users         → seznam všech uživatelů
// POST   /api/admin/users         body: { email, role }  → přidat uživatele
// DELETE /api/admin/users?email=x → smazat uživatele
//
// Ukládá se do KV namespace APP_DATA pod klíčem "users".

async function requireAuth(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.includes('session=');
}

const KV_KEY = 'users';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const VALID_ROLES = ['admin', 'editor', 'viewer'];

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const raw = await env.APP_DATA.get(KV_KEY);
  const users = raw ? JSON.parse(raw) : [];
  return json({ users });
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

  const email = (body.email || '').trim().toLowerCase();
  const role = (body.role || 'editor').trim().toLowerCase();

  if (!validateEmail(email)) {
    return json({ error: 'Neplatný e-mail' }, 400);
  }

  if (!VALID_ROLES.includes(role)) {
    return json({ error: 'Neplatná role. Povolené: ' + VALID_ROLES.join(', ') }, 400);
  }

  const raw = await env.APP_DATA.get(KV_KEY);
  const users = raw ? JSON.parse(raw) : [];

  // Už existuje?
  if (users.find(u => u.email === email)) {
    return json({ error: 'Uživatel s tímto e-mailem už existuje' }, 409);
  }

  const newUser = {
    email,
    role,
    added: new Date().toISOString()
  };

  users.push(newUser);
  await env.APP_DATA.put(KV_KEY, JSON.stringify(users));

  return json({ ok: true, user: newUser });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();

  if (!email) {
    return json({ error: 'Chybí parametr email' }, 400);
  }

  const raw = await env.APP_DATA.get(KV_KEY);
  const users = raw ? JSON.parse(raw) : [];

  const filtered = users.filter(u => u.email !== email);

  if (filtered.length === users.length) {
    return json({ error: 'Uživatel nenalezen' }, 404);
  }

  await env.APP_DATA.put(KV_KEY, JSON.stringify(filtered));

  return json({ ok: true });
}
