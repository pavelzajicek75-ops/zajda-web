export async function onRequestPost(context) {
  try {
    const auth = context.request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = auth.replace("Bearer ", "").trim();
    const secret = context.env.ADMIN_JWT_SECRET;
    await context.env.JWT.verify(token, secret);

    const contentType = context.request.headers.get("Content-Type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ success: false, error: "Invalid form" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const formData = await context.request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({ success: false, error: "No file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const key = `${Date.now()}_${file.name}`;

    await context.env.PHOTOS_BUCKET.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    });

    return new Response(JSON.stringify({ success: true, key }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Upload failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
