export async function onRequest(context) {
  const bucket = context.env.SECTIONS_BUCKET;
  const body = await context.request.json();

  await bucket.put("subsections.json", JSON.stringify(body), {
    httpMetadata: { contentType: "application/json" }
  });

  return Response.json({ ok: true });
}
