// /functions/api/quotes/list.js

export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_quotes;

  const fileName = "quotes.json";
  const method = request.method.toUpperCase();

  // --- GET: načtení citátů ---
  if (method === "GET") {
    const file = await bucket.get(fileName);

    if (!file) {
      // Pokud soubor neexistuje, vrátíme prázdné pole
      return new Response(JSON.stringify({ quotes: [] }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const text = await file.text();
    const quotes = JSON.parse(text);

    return new Response(JSON.stringify({ quotes }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // --- POST: uložení citátů z dashboardu ---
  if (method === "POST") {
    const body = await request.json();

    if (!body.quotes || !Array.isArray(body.quotes)) {
      return new Response(JSON.stringify({ error: "Invalid format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await bucket.put(fileName, JSON.stringify(body.quotes, null, 2), {
      httpMetadata: { contentType: "application/json" }
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // --- Ostatní metody ---
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}
