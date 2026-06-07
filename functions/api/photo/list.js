export async function onRequest(context) {
  const bucket = context.env.PHOTOS_R2;
  const list = await bucket.list({ prefix: "" });

  const photos = list.objects.map(obj => ({
    key: obj.key,
    url: `https://pub-zajda-photos.r2.dev/${obj.key}`
  }));

  return Response.json(photos);
}

