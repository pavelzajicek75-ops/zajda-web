// Společný sběr dat pro ruční stažení zálohy i automatickou zálohu do R2.
async function listAll(kv, prefix) {
  const out = [];
  const list = await kv.list({ prefix });
  for (const key of list.keys) {
    const data = await kv.get(key.name, { type: 'json' });
    if (data) out.push(data);
  }
  return out;
}

export async function collectBackup(env) {
  const backup = {
    exportedAt: new Date().toISOString(),
    version: 1
  };
  backup.articles = await listAll(env.ARTICLES, 'article:');
  backup.timeline = await listAll(env.ARTICLES, 'timeline:');
  backup.about = await env.ARTICLES.get('about:zajda', { type: 'json' });
  backup.commentsPending = await env.ARTICLES.get('meta:comments-pending', { type: 'json' });
  backup.moodLog = await env.ARTICLES.get('meta:mood-log', { type: 'json' });
  backup.ideas = await env.ARTICLES.get('meta:ideas', { type: 'json' });
  backup.site = await env.ARTICLES.get('meta:site', { type: 'json' });
  backup.messages = await env.ARTICLES.get('meta:messages', { type: 'json' });
  backup.sections = await listAll(env.SUBSECTIONS, 'section:');
  backup.subsections = await listAll(env.SUBSECTIONS, 'subsection:');
  if (env.PHOTOS) backup.galleries = await listAll(env.PHOTOS, 'gallery:');
  if (env.QUOTES_R2) {
    backup.quotes = [];
    const quotesList = await env.QUOTES_R2.list({ prefix: 'quotes/' });
    for (const obj of quotesList.objects) {
      const file = await env.QUOTES_R2.get(obj.key);
      if (file) {
        try { backup.quotes.push(await file.json()); } catch (e) { /* přeskočit poškozený záznam */ }
      }
    }
  }
  return backup;
}
