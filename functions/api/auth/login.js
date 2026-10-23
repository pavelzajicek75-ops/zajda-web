// functions/api/auth/login.js
//
// OPRAVA: Přepis z KV sessions na JWT — žádné zápisy do KV, žádné limity.
// Token je teď JWT podepsaný HMAC-SHA256, frontend ho ukládá do localStorage
// stejně jako dřív. Žádný env.SESSIONS.put() → žádný KV limit.

import { hashPassword, signJWT } from '../_auth-utils.js';
import { isLimited, record } from '../_ratelimit.js';
import { notifyAdmin } from '../push/_push.js';

// Porovnání bez úniku časem (nezáleží, na kolikátém znaku se hesla liší).
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b)))
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Přihlášení z nového zařízení (jiný prohlížeč / jiná země) → klepnutí na zařízení správce.
// Zapisuje do KV jen když je zařízení opravdu nové (max. pár zápisů za celou dobu).
async function checkNewDevice(context, user) {
  const { request, env } = context;
  try {
    if (!env.ARTICLES) return;
    const ua = request.headers.get('User-Agent') || '';
    const country = (request.cf && request.cf.country) || '';
    const raw = new TextEncoder().encode(user + '|' + ua + '|' + country);
    const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw))).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    const seen = (await env.ARTICLES.get('meta:login-seen', { type: 'json' })) || [];
    if (seen.includes(h)) return;
    seen.push(h);
    await env.ARTICLES.put('meta:login-seen', JSON.stringify(seen.slice(-40)));
    const job = notifyAdmin(env, 'login', new URL(request.url).origin);
    if (typeof context.waitUntil === 'function') context.waitUntil(job); else await job;
  } catch (e) { /* oznámení nesmí rozbít přihlášení */ }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (isLimited('login', request, 8, 15 * 60 * 1000) || isLimited('login-h', request, 20, 60 * 60 * 1000)) {
    return Response.json({ error: 'Příliš mnoho pokusů. Zkus to za chvíli.' }, { status: 429 });
  }

  try {
    const { username, password } = await request.json();
    const ADMIN_USER = env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASS = env.ADMIN_PASSWORD;

    if (!ADMIN_PASS) {
      return Response.json({ error: 'Chybí ADMIN_PASSWORD v env vars' }, { status: 500 });
    }

    let authedUser = null;
    let role = 'admin';

    // 1) Hlavní admin účet — vždy přednost
    if (username === ADMIN_USER && typeof password === 'string' && await safeEqual(password, ADMIN_PASS)) {
      authedUser = ADMIN_USER;
      role = 'admin';
    } else if (env.APP_DATA) {
      // 2) Pozvaní uživatelé v KV (jen čtení — žádný zápis)
      try {
        const raw = await env.APP_DATA.get('user:' + String(username).toLowerCase());
        if (raw) {
          const record = JSON.parse(raw);
          const hash = await hashPassword(password, record.salt);
          if (hash === record.passwordHash) {
            authedUser = record.email;
            role = record.role || 'editor';
          }
        }
      } catch (kvErr) {
        console.error('Chyba při čtení APP_DATA KV:', kvErr.message);
      }
    }

    if (!authedUser) {
      record('login', request, 15 * 60 * 1000);
      record('login-h', request, 60 * 60 * 1000);
      await sleep(700 + Math.random() * 500);   // zpomalení hádání hesel
      return Response.json({ error: 'Špatné přihlašovací údaje' }, { status: 401 });
    }

    // Vytvoření JWT tokenu (žádný KV zápis!)
    const token = await signJWT({ user: authedUser, role }, env);
    await checkNewDevice(context, authedUser);

    return Response.json({ ok: true, token, user: authedUser, role });

  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
