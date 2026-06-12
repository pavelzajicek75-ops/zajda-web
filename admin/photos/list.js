export async function onRequestGet(context) {
  try {
    const auth = context.request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = auth.replace("Bearer ", "").trim();
    const secret = context.env.ADMIN_JWT_SECRET;
    await context.env.JWT.verify(token, secret);

    const bucket = context.env.PHOTOS_BUCKET;
    const objects = [];
    for await (const obj of bucket.list()) {
      const url = context.env.CDN_BASE_URL
        ? `${context.env.CDN_BASE_URL}/${obj.key}`
        : `/r2/${obj.key}`;
      objects.push({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        url
      });
    }

    return new Response(JSON.stringify(objects), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
}
