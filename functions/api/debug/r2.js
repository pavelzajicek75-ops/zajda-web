export async function onRequestGet(context) {
  const { env } = context;
  
  const bindings = {
    available: Object.keys(env).filter(k => !k.startsWith('__')),
    photos_r2: env.PHOTOS_R2 ? 'OK' : 'CHYBÍ - přidej v Pages Settings > Functions',
    quotes_r2: env.QUOTES_R2 ? 'OK' : 'CHYBÍ - přidej v Pages Settings > Functions',
    photos_kv: env.PHOTOS ? 'OK' : 'CHYBÍ',
    articles_kv: env.ARTICLES ? 'OK' : 'CHYBÍ',
    sessions_kv: env.SESSIONS ? 'OK' : 'CHYBÍ',
    subsections_kv: env.SUBSECTIONS ? 'OK' : 'CHYBÍ',
  };

  const quotes = [];
  if (env.QUOTES_R2) {
    try {
      const list = await env.QUOTES_R2.list({ limit: 5 });
      for (const obj of list.objects || []) {
        quotes.push({ key: obj.key, size: obj.size });
      }
    } catch (e) {
      bindings.quotes_error = e.message;
    }
  }

  return Response.json({ bindings, sample_quotes: quotes });
}
