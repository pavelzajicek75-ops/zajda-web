// functions/api/quotes/list.js
export async function onRequestGet(context) {
  const { env } = context;
  // DŮLEŽITÉ: Změň QUOTES_R2 na název tvého R2 bindingu
  const list = await env.QUOTES_R2.list({ prefix: 'quotes/' });
  const quotes = [];
  for (const obj of list.objects || []) {
    const data = await env.QUOTES_R2.get(obj.key);
    if (data) quotes.push(await data.json());
  }
  return Response.json(quotes);
}
