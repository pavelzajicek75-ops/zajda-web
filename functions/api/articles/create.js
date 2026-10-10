import { requireAdmin, json } from '../_auth-utils.js';
import { newShareToken } from './_publish.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const id = crypto.randomUUID();

  // ★ ZMĚNA: přidána volitelná pole lat/lng (souřadnice místa) vedle
  // stávajícího textového "place". Obě jsou nepovinná — pokud je
  // frontend/editor nepošle, zůstanou null a článek se na mapě
  // jednoduše neobjeví (mapa bude filtrovat jen články, co lat/lng mají).
  // Explicitní Number(...) + kontrola isFinite, ať se do KV nikdy
  // neuloží nesmyslná hodnota (např. prázdný string nebo text omylem
  // poslaný z formuláře).
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  // ★ ZMĚNA: volitelná "cesta" — víc zastávek v jednom článku (např.
  // "dnes jsme projeli Vídeň → Bratislavu → Budapešť"). Když má článek
  // 2+ platných zastávek, mapa ho kreslí jako úsek/čáru místo jednoho
  // bodu. Každá zastávka se čistí zvlášť, ať jeden špatný záznam
  // nezahodí celé pole.
  const stops = Array.isArray(body.stops)
    ? body.stops
        .map(s => ({
          place: (s && s.place) || '',
          lat: Number(s && s.lat),
          lng: Number(s && s.lng)
        }))
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    : [];

  const article = {
    id,
    title: body.title || '',
    content: body.content || '',
    sectionId: body.sectionId || '',
    subsectionId: body.subsectionId || '',
    date: body.date || '',
    place: body.place || '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    stops: stops.length >= 2 ? stops : [],
    // 📷 zastávka, kam patří fotky z výletu (index v poli stops); jinak se odhadne
    photoStop: (stops.length >= 2 && Number.isInteger(body.photoStop) && body.photoStop >= 0 && body.photoStop < stops.length) ? body.photoStop : null,
    excerpt: body.excerpt || '',
    coverUrl: body.coverUrl || '',
    slug: body.slug || '',
    // koncept = published:false; s publishAt se po daném čase zveřejní sám
    published: body.published !== false,
    publishAt: body.published === false && body.publishAt ? String(body.publishAt) : '',
    // soukromý článek: mimo veřejný výpis, otevře se jen odkazem s tokenem
    unlisted: body.unlisted === true,
    shareToken: body.unlisted === true ? newShareToken() : '',
    created: Date.now()
  };
  await env.ARTICLES.put(`article:${id}`, JSON.stringify(article));
  return Response.json(article);
}
