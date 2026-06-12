export async function onRequestGet(context) {
  try {
    const auth = context.request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = auth.replace("Bearer ", "").trim();
    const secret = context.env.ADMIN_JWT_SECRET;
    await context.env.JWT.verify(token, secret);

    const url = new URL(context.request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const obj = await context.env.PHOTOS_BUCKET.head(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const info = {
      key,
      size: obj.size,
      uploaded: obj.uploaded,
      contentType: obj.httpMetadata?.contentType || null
      // sem můžeš později doplnit EXIF z externí služby
    };

    return new Response(JSON.stringify(info), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Info failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
