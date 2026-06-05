// /functions/api/photo/save-version.js

export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;

  if (!bucket) {
    return new Response("R2 bucket zajda_photos is not bound", { status: 500 });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let data;
  try {
    data = await request.json();
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { name, file } = data;

  if (!name || !file) {
    return new Response("Missing file or name", { status: 400 });
  }

  try {
    const binary = Uint8Array.from(atob(file), c => c.charCodeAt(0));

    await bucket.put(name, binary, {
      httpMetadata: { contentType: "image/jpeg" }
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response("Upload failed: " + err.message, { status: 500 });
  }
}
