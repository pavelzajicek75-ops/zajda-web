export async function onRequest(context) {
  const { R2 } = context.env;
  const list = await R2.list();

  const photos = [];

  for (const obj of list.objects) {
    let exif = {};
    let tags = [];

    if (obj.customMetadata) {
      if (obj.customMetadata.exif) {
        try { exif = JSON.parse(obj.customMetadata.exif); } catch {}
      }
      if (obj.customMetadata.tags) {
        try { tags = JSON.parse(obj.customMetadata.tags); } catch {}
      }
    }

    photos.push({
      name: obj.key,
      size: obj.size,
      url: `https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/${obj.key}`,
      exif,
      tags
    });
  }

  const totalSize = list.objects.reduce((sum, o) => sum + o.size, 0);

  return new Response(JSON.stringify({
    totalCount: photos.length,
    totalSize,
    photos
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
