export async function onRequest(context) {
  const { QUOTES_R2 } = context.env;

  try {
    const list = await QUOTES_BUCKET.list({ prefix: "quotes/" });
    const quotes = [];

    for (const obj of list.objects) {
      const file = await QUOTES_BUCKET.get(obj.key);
      if (!file) continue;
      quotes.push(await file.json());
    }

    if (quotes.length === 0) {
      return new Response(JSON.stringify({
        text: "Žádné citáty nenalezeny.",
        author: "System"
      }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      });
    }

    const random = quotes[Math.floor(Math.random() * quotes.length)];

    return new Response(JSON.stringify(random), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  }
}
