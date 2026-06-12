// ============================================
// /functions/api/photo/metadata.js
// ============================================

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const filename = url.searchParams.get("file");

    if (!filename) {
      return new Response(
        JSON.stringify({ error: "Missing ?file= parameter" }),
        { status: 400 }
      );
    }

    const object = await env.PHOTOS_BUCKET.head(filename);

    if (!object) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404 }
      );
    }

    const metadata = {
      size: object.size,
      uploaded: object.uploaded,
      etag: object.etag,
      httpMetadata: {
        contentType: "application/json"
      }
    };

    return new Response(JSON.stringify(metadata), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}
