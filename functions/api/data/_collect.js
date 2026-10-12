// Společný sběr dat pro ruční stažení zálohy i automatickou zálohu do R2.
// Seznamy klíčů se berou z indexu (_kv-index.js) — šetří denní limit operací „list“.
// Poškozený jednotlivý záznam (neplatný JSON) zálohu nezhatí: přeskočí se a zapíše do `warnings`.
import { listIndexed } from '../_kv-index.js';

async function listAll(env, kv, prefix, tag, warnings) {
  const out = [];
  const list = await listIndexed(kv, env.ARTICLES, prefix, { tag, allowEmpty: true });
  for (const key of list.keys) {
    let raw;
    try { raw = await kv.get(key.name); }
    catch (e) { throw new Error('čtení ' + key.name + ': ' + (e && e.message ? e.message : e)); }
    if (raw == null) continue;
    try { out.push(JSON.parse(raw)); }
    catch (e) { warnings.push('Poškozený záznam přeskočen: ' + key.name); }
  }
  return out;
}

async function getJson(env, key, warnings) {
  try { return await env.ARTICLES.get(key, { type: 'json' }); }
  catch (e) { warnings.push('Nečitelný záznam přeskočen: ' + key); return null; }
}

export async function collectBackup(env) {
  const warnings = [];
  const backup = { exportedAt: new Date().toISOString(), version: 1 };
  backup.articles = await listAll(env, env.ARTICLES, 'article:', '', warnings);
  backup.timeline = await listAll(env, env.ARTICLES, 'timeline:', '', warnings);
  backup.about = await getJson(env, 'about:zajda', warnings);
  backup.commentsPending = await getJson(env, 'meta:comments-pending', warnings);
  backup.moodLog = await getJson(env, 'meta:mood-log', warnings);
  backup.ideas = await getJson(env, 'meta:ideas', warnings);
  backup.site = await getJson(env, 'meta:site', warnings);
  backup.messages = await getJson(env, 'meta:messages', warnings);
  backup.sections = await listAll(env, env.SUBSECTIONS, 'section:', ':S', warnings);
  backup.subsections = await listAll(env, env.SUBSECTIONS, 'subsection:', ':S', warnings);
  if (env.PHOTOS) backup.galleries = await listAll(env, env.PHOTOS, 'gallery:', ':P', warnings);
  if (env.QUOTES_R2) {
    backup.quotes = [];
    try {
      const quotesList = await env.QUOTES_R2.list({ prefix: 'quotes/' });
      for (const obj of quotesList.objects) {
        try {
          const file = await env.QUOTES_R2.get(obj.key);
          if (file) backup.quotes.push(await file.json());
        } catch (e) { warnings.push('Poškozený citát přeskočen: ' + obj.key); }
      }
    } catch (e) { warnings.push('Citáty se nepodařilo načíst: ' + (e && e.message ? e.message : e)); }
  }
  if (warnings.length) backup.warnings = warnings;
  return backup;
}
