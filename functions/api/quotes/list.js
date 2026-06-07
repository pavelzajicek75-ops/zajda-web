export async function onRequest(context) {
  const bucket = context.env.QUOTES_R2;
  const list = await bucket.list({ prefix: "" });

  const quotes = await Promise.all(
    list.objects.map(async (obj) => {
      const file = await bucket.get(obj.key);
      const text = await file.text();
      return JSON.parse(text);
    })
  );

  return Response.json(quotes);
}
