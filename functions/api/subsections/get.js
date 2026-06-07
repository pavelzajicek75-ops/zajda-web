export async function onRequest(context) {
  const bucket = context.env.SECTIONS_BUCKET;
  const file = await bucket.get("subsections.json");
  if (!file) return Response.json({});
  const json = await file.json();
  return Response.json(json);
}
