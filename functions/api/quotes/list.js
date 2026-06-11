export async function onRequest(context) {
  const { QUOTES_BUCKET } = context.env;

  const objects = await QUOTES_BUCKET.list({ prefix: "quotes/" });
  const quotes = [];

  for (const obj of objects.objects) {
    const file = await QUOTES_BUCKET.get(obj.key);
    if (!file) continue;
    quotes.push(await file.json());
  }

  return new Response(JSON.stringify(quotes), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}
