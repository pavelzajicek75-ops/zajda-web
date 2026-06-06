export async function onRequest(context) {
  const { env } = context;

  const list = await env.QUOTES.list();
  const quotes = [];

  for (const key of list.keys) {
    const raw = await env.QUOTES.get(key.name);
    if (!raw) continue;

    const data = JSON.parse(raw);
    quotes.push(data);
  }

  return new Response(JSON.stringify({ quotes }), {
    headers: { "Content-Type": "application/json" }
  });
}
