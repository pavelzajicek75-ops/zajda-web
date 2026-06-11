// rebuild trigger – nový plně funkční soubor pro Cloudflare Pages

export async function onRequest(context) {
  const { QUOTES_BUCKET } = context.env;

  try {
    // načtení všech souborů z R2 bucketu
    const list = await QUOTES_BUCKET.list({ prefix: "quotes/" });
    const quotes = [];

    for (const obj of list.objects) {
      const file = await QUOTES_BUCKET.get(obj.key);
      if (!file) continue;
      const data = await file.json();
      quotes.push(data);
    }

    // pokud nejsou žádné citáty
    if (quotes.length === 0) {
      return new Response(JSON.stringify({ text: "Žádné citáty nenalezeny.", author: "System" }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      });
    }

    // náhodný citát
    const random = quotes[Math.floor(Math.random() * quotes.length)];

    return new Response(JSON.stringify(random), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
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
