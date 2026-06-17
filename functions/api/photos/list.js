export async function onRequestGet(context) {
  const { env } = context;
  // Načteme všechny fotky z jedné hlavní galerie (první dostupná nebo main)
  const list = await env.PHOTOS.list({ prefix: 'gallery:' });
  if (!list.keys.length) return Response.json([]);
  
  // Použijeme první existující galerii jako hlavní
  const mainKey = list.keys[0].name;
  const data = await env.PHOTOS.get(mainKey, { type: 'json' });
  return Response.json(data?.photos || []);
}
