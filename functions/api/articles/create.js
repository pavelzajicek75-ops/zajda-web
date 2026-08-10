export async function onRequestPost(context) {
  const { request, env } = context;
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
    created: Date.now()
  };
  await env.ARTICLES.put(`article:${id}`, JSON.stringify(article));
  return Response.json(article);
}
