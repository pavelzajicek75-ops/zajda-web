export async function onRequest(context) {
  const { QUOTES } = context.env;

  try {
    // načti seznam objektů
    const list = await QUOTES.list();
    const keys = list.objects.map(o => o.key);

    if (keys.length === 0) {
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

    // náhodný klíč
    const randomKey = keys[Math.floor(Math.random() * keys.length)];

    // načti JSON soubor
    const file = await QUOTES.get(randomKey);
    const data = await file.json();

    return new Response(JSON.stringify(data), {
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
