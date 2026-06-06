// /functions/api/photo/save-version.js

export async function onRequestGet() {
  return new Response(JSON.stringify({ error: "GET not supported, use POST" }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.zajda_photos) {
      return new Response(JSON.stringify({ error: "R2 binding 'zajda_photos' is missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const form = await request.formData();
    const file = form.get("file");
    const name = form.get("name");
    const version = form.get("version") || "original";

    if (!file || !name) {
      return new Response(JSON.stringify({ error: "Missing file or name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const key = `versions/${name}/${version}.jpg`;

    await env.zajda_photos.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || "image/jpeg"
      }
    });

    return new Response(JSON.stringify({
      success: true,
      saved: key
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
