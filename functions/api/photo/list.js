export async function onRequest(context) {
  const bucket = context.env.PHOTOS_BUCKET;
  const list = await bucket.list({ prefix: "" });

  const photos = list.objects.map(o => ({
    url: `https://pub-${context.env.PHOTOS_BUCKET_NAME}.r2.dev/${o.key}`
  }));

  return Response.json({ photos });
}
