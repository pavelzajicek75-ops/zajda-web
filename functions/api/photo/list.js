// /functions/api/photo/list.js

export async function onRequest(context) {
  const bucket = context.env.zajda_photos;

  if (!bucket) {
    return new Response(JSON.stringify({ error: "R2 bucket zajda_photos is not bound" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const files = [];
    let cursor;

    // List all objects in the bucket
    while (true) {
      const result = await bucket.list({ cursor, limit: 100 });

      for (const object of result.objects) {
        files.push({
          key: object.key,
          size: object.size,
          uploaded: object.uploaded,
          etag: object.etag
        });
      }

      if (!result.truncated) break;
      cursor = result.cursor;
    }

    return new Response(JSON.stringify({ files, total: files.length }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
