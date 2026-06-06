export async function onRequest(context) {
  const { env } = context;

  const object = await env.QUOTES_R2.get("quotes.json");
  if (!object) {
    return new Response(JSON.stringify({ quotes: [] }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const data = await object.text();
  const quotes = JSON.parse(data);

  return new Response(JSON.stringify({ quotes }), {
    headers: { "Content-Type": "application/json" }
  });
}
