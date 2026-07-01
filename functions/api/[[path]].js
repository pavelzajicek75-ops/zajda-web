// functions/api/[[path]].js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =========================================
    // ARTICLES
    // =========================================
    if (path === 'articles/list' && method === 'GET') {
      const list = await env.ARTICLES.list();
      const articles = [];
      for (const key of list.keys) {
        const val = await env.ARTICLES.get(key.name);
        if (val) articles.push(JSON.parse(val));
      }
      articles.sort((a, b) => new Date(b.date || b.created) - new Date(a.date || a.created));
      return jsonResponse(articles, corsHeaders);
    }

    if (path === 'articles/get' && method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return jsonResponse({ error: 'Missing id' }, corsHeaders, 400);
      const val = await env.ARTICLES.get(id);
      if (!val) return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
      return jsonResponse(JSON.parse(val), corsHeaders);
    }

    if (path === 'articles/create' && method === 'POST') {
      const body = await request.json();
      const id = crypto.randomUUID();
      const article = { id, ...body, created: new Date().toISOString() };
      await env.ARTICLES.put(id, JSON.stringify(article));
      return jsonResponse(article, corsHeaders);
    }

    if (path === 'articles/update' && method === 'POST') {
      const body = await request.json();
      const { id, ...data } = body;
      if (!id) return jsonResponse({ error: 'Missing id' }, corsHeaders, 400);
      const existing = await env.ARTICLES.get(id);
      if (!existing) return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
      const updated = { ...JSON.parse(existing), ...data, modified: new Date().toISOString() };
      await env.ARTICLES.put(id, JSON.stringify(updated));
      return jsonResponse(updated, corsHeaders);
    }

    if (path === 'articles/delete' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return jsonResponse({ error: 'Missing id' }, corsHeaders, 400);
      await env.ARTICLES.delete(id);
      return jsonResponse({ success: true }, corsHeaders);
    }

    // =========================================
    // PHOTOS / GALLERY
    // =========================================
    if (path === 'photos/list' && method === 'GET') {
      const galleryId = url.searchParams.get('galleryId') || 'main';
      const list = await env.PHOTOS_R2.list();
      const photos = list.objects
        .filter(o => o.key.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
        .map(o => ({
          id: o.key,
          key: o.key,
          name: o.key.split('/').pop(),
          url: `${env.CDN_BASE_URL || ''}/${o.key}`,
          size: o.size,
          uploaded: o.uploaded
        }));
      return jsonResponse(photos, corsHeaders);
    }

    if (path === 'photos/upload' && method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return jsonResponse({ error: 'No file' }, corsHeaders, 400);

      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await env.PHOTOS_R2.put(filename, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      return jsonResponse({
        success: true,
        key: filename,
        url: `${env.CDN_BASE_URL || ''}/${filename}`
      }, corsHeaders);
    }

    if (path === 'photos/update' && method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      const oldKey = formData.get('oldKey');
      const mode = formData.get('mode') || 'replace';

      if (!file) return jsonResponse({ error: 'No file' }, corsHeaders, 400);

      const filename = oldKey || `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await env.PHOTOS_R2.put(filename, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      return jsonResponse({
        success: true,
        key: filename,
        url: `${env.CDN_BASE_URL || ''}/${filename}`
      }, corsHeaders);
    }

    // =========================================
    // QUOTES
    // =========================================
    if (path === 'quotes/list' && method === 'GET') {
      const list = await env.QUOTES_R2.list();
      const quotes = [];
      for (const obj of list.objects) {
        const val = await env.QUOTES_R2.get(obj.key);
        if (val) quotes.push(JSON.parse(await val.text()));
      }
      return jsonResponse(quotes, corsHeaders);
    }

    if (path === 'quotes/create' && method === 'POST') {
      const body = await request.json();
      const id = crypto.randomUUID();
      const quote = { id, ...body, created: new Date().toISOString() };
      await env.QUOTES_R2.put(id, JSON.stringify(quote));
      return jsonResponse(quote, corsHeaders);
    }

    if (path === 'quotes/delete' && method === 'DELETE') {
      const key = url.searchParams.get('key');
      if (!key) return jsonResponse({ error: 'Missing key' }, corsHeaders, 400);
      await env.QUOTES_R2.delete(key);
      return jsonResponse({ success: true }, corsHeaders);
    }

    // =========================================
    // SUBSECTIONS
    // =========================================
    if (path === 'subsections/by-section' && method === 'GET') {
      const sectionId = url.searchParams.get('sectionId');
      if (!sectionId) return jsonResponse([], corsHeaders);
      const list = await env.SUBSECTIONS.list({ prefix: `${sectionId}/` });
      const subs = [];
      for (const key of list.keys) {
        const val = await env.SUBSECTIONS.get(key.name);
        if (val) subs.push(JSON.parse(val));
      }
      subs.sort((a, b) => (a.order || 0) - (b.order || 0));
      return jsonResponse(subs, corsHeaders);
    }

    if (path === 'subsections/create' && method === 'POST') {
      const body = await request.json();
      const id = crypto.randomUUID();
      const sub = { id, ...body, created: new Date().toISOString() };
      await env.SUBSECTIONS.put(`${body.sectionId}/${id}`, JSON.stringify(sub));
      return jsonResponse(sub, corsHeaders);
    }

    if (path === 'subsections/delete' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return jsonResponse({ error: 'Missing id' }, corsHeaders, 400);
      // Hledáme klíč napříč sekcemi
      const list = await env.SUBSECTIONS.list();
      for (const key of list.keys) {
        if (key.name.endsWith(`/${id}`)) {
          await env.SUBSECTIONS.delete(key.name);
          break;
        }
      }
      return jsonResponse({ success: true }, corsHeaders);
    }

    if (path === 'subsections/update' && method === 'POST') {
      const body = await request.json();
      const { id, ...data } = body;
      const list = await env.SUBSECTIONS.list();
      for (const key of list.keys) {
        if (key.name.endsWith(`/${id}`)) {
          const existing = JSON.parse(await env.SUBSECTIONS.get(key.name));
          const updated = { ...existing, ...data };
          await env.SUBSECTIONS.put(key.name, JSON.stringify(updated));
          return jsonResponse(updated, corsHeaders);
        }
      }
      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
    }

    // =========================================
    // SECTIONS (covers)
    // =========================================
    if (path === 'sections/cover' && method === 'GET') {
      const sectionId = url.searchParams.get('sectionId');
      if (!sectionId) return jsonResponse({ error: 'Missing sectionId' }, corsHeaders, 400);
      const val = await env.SUBSECTIONS.get(`_cover_${sectionId}`);
      return jsonResponse(val ? JSON.parse(val) : { coverUrl: '' }, corsHeaders);
    }

    if (path === 'sections/cover' && method === 'POST') {
      const body = await request.json();
      const { sectionId, coverUrl } = body;
      if (!sectionId) return jsonResponse({ error: 'Missing sectionId' }, corsHeaders, 400);
      await env.SUBSECTIONS.put(`_cover_${sectionId}`, JSON.stringify({ sectionId, coverUrl }));
      return jsonResponse({ success: true }, corsHeaders);
    }

    // =========================================
    // ABOUT
    // =========================================
    if (path === 'about/get' && method === 'GET') {
      const val = await env.SUBSECTIONS.get('_about');
      return jsonResponse(val ? JSON.parse(val) : { title: '', text: '' }, corsHeaders);
    }

    if (path === 'about/update' && method === 'POST') {
      const body = await request.json();
      await env.SUBSECTIONS.put('_about', JSON.stringify(body));
      return jsonResponse({ success: true }, corsHeaders);
    }

    // =========================================
    // CACHE PURGE
    // =========================================
    if (path === 'cache/purge' && method === 'POST') {
      return jsonResponse({ success: true, message: 'Cache purge requested' }, corsHeaders);
    }

    // =========================================
    // 404
    // =========================================
    return jsonResponse({ error: 'Not found', path }, corsHeaders, 404);

  } catch (e) {
    console.error('API Error:', e);
    return jsonResponse({ error: e.message }, corsHeaders, 500);
  }
}

function jsonResponse(data, headers, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}
