export async function onRequest(context) {
  const { QUOTES_BUCKET } = context.env;

  const objects = await QUOTES_BUCKET.list({ prefix: "quotes/" });
  if (!objects.objects.length) {
    return new Response(JSON.stringify({ error: "No quotes available" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  }

  const randomObj = objects.objects[Math.floor(Math.random() * objects.objects.length)];
  const file = await QUOTES_BUCKET.get(randomObj.key);
  const json = await file.json();

  return new Response(JSON.stringify(json), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
