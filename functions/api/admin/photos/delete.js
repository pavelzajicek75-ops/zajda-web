export async function onRequestPost(context) {
  try {
    const auth = context.request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = auth.replace("Bearer ", "").trim();
    const secret = context.env.ADMIN_JWT_SECRET;
    await context.env.JWT.verify(token, secret);

    const body = await context.request.json();
    const key = body.key;
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: "Missing key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await context.env.PHOTOS_BUCKET.delete(key);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Delete failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
