export async function onRequest(context) {
  const bucket = context.env.PHOTOS;   // 🔥 MUSÍ být binding na zajda-photos

  const list = await bucket.list({ prefix: "" });

  const photos = list.objects.map(o => ({
    url: `https://pub-${context.env.PHOTOS_BUCKET_NAME}.r2.dev/${o.key}`
  }));

  return Response.json({ photos });
}

