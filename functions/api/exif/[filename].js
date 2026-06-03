// /functions/api/exif/[filename].js

import EXIF from "exifreader";

export async function onRequest(context) {
  const bucket = context.env.zajda_photos;
  const { filename } = context.params;
  const decoded = decodeURIComponent(filename);

  const object = await bucket.get(decoded);
  if (!object) return new Response("Not found", { status: 404 });

  const arrayBuffer = await object.arrayBuffer();
  const tags = EXIF.load(arrayBuffer);

  const data = {
    model: tags.Model?.description || "",
    make: tags.Make?.description || "",
    date: tags.DateTimeOriginal?.description || "",
    iso: tags.ISO?.value || "",
    aperture: tags.FNumber?.description || "",
    shutter: tags.ExposureTime?.description || "",
    focal: tags.FocalLength?.description || ""
  };

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}
