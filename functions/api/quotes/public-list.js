export async function onRequest(context) {
  const { env } = context;

  const object = await env.QUOTES_R2.get("quotes.json");
  if (!object) {
    return new Response(JSON.stringify({ quotes: [] }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const quotes = JSON.parse(await object.text());
  const publicQuotes = quotes.map(q => ({
    text: q.text,
    author: q.author
  }));

  return new Response(JSON.stringify({ quotes: publicQuotes }), {
    headers: { "Content-Type": "application/json" }
  });
}
