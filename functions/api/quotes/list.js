export async function onRequest(context) {
  const { QUOTES } = context.env;

  try {
    // načti seznam objektů v bucketu
    const list = await QUOTES.list();
    const quotes = [];

    // projdi všechny soubory a načti JSON
    for (const obj of list.objects) {
      const file = await QUOTES.get(obj.key);
      if (!file) continue;

      const data = await file.json();
      quotes.push(data);
    }

    // vrať čisté pole objektů (NE dvojité pole!)
    return new Response(JSON.stringify(quotes), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
