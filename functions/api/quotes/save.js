export async function onRequest(context) {
  const bucket = context.env.QUOTES_R2;
  const data = await context.request.json();
  const key = `${Date.now()}-${data.author}.json`;

  await bucket.put(key, JSON.stringify(data));
  return Response.json({ ok: true });
}
