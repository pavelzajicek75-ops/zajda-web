export async function onRequest(context) {
  const bucket = context.env.PHOTOS_BUCKET;
  const list = await bucket.list({ prefix: "" });

  const photos = list.objects.map(o => ({
    url: `https://pub-zajda-photos.r2.dev/${o.key}` // pevný název bucketu
  }));

  return Response.json({ photos });
}
