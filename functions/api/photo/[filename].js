// /functions/api/photo/[filename].js

export async function onRequestGet(context) {
  const bucket = context.env.zajda_photos;
  const { filename } = context.params;
  
  if (!bucket) {
    return new Response("R2 bucket zajda_photos is not bound", { status: 500 });
  }

  if (!filename) {
    return new Response("Missing filename", { status: 400 });
  }

  const decoded = decodeURIComponent(filename);

  try {
    const object = await bucket.get(decoded);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "max-age=86400"
      }
    });
  } catch (err) {
    return new Response("Error fetching file: " + err.message, { status: 500 });
  }
}

export async function onRequestPut(context) {
  const bucket = context.env.zajda_photos;
  const { filename } = context.params;

  if (!bucket) {
    return new Response("R2 bucket zajda_photos is not bound", { status: 500 });
  }

  if (!filename) {
    return new Response("Missing filename", { status: 400 });
  }

  const decoded = decodeURIComponent(filename);

  try {
    const arrayBuffer = await context.request.arrayBuffer();
    const contentType = context.request.headers.get("content-type") || "image/jpeg";

    await bucket.put(decoded, arrayBuffer, {
      httpMetadata: { contentType }
    });

    return new Response(JSON.stringify({ success: true, file: decoded }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response("Error uploading file: " + err.message, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const bucket = context.env.zajda_photos;
  const { filename } = context.params;

  if (!bucket) {
    return new Response("R2 bucket zajda_photos is not bound", { status: 500 });
  }

  if (!filename) {
    return new Response("Missing filename", { status: 400 });
  }

  const decoded = decodeURIComponent(filename);

  try {
    await bucket.delete(decoded);
    return new Response(JSON.stringify({ success: true, deleted: decoded }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response("Error deleting file: " + err.message, { status: 500 });
  }
}
