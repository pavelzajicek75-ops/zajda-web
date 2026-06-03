// /functions/api/photo/[filename].js

export async function onRequestGet(context) {
  const bucket = context.env.zajda_photos;
  const { filename } = context.params;
  const decoded = decodeURIComponent(filename);

  const object = await bucket.get(decoded);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache"
    }
  });
}

export async function onRequestPut(context) {
  const bucket = context.env.zajda_photos;
  const { filename } = context.params;
  const decoded = decodeURIComponent(filename);

  const arrayBuffer = await context.request.arrayBuffer();
  await bucket.put(decoded, arrayBuffer, {
    httpMetadata: { contentType: "image/jpeg" }
  });

  return new Response("OK");
}

export async function onRequestDelete(context) {
  const bucket = context.env.zajda_photos;
  const { filename } = context.params;
  const decoded = decodeURIComponent(filename);

  await bucket.delete(decoded);
  return new Response("OK");
}
