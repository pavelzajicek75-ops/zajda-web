export async function onRequestPost(context) {
  const { R2 } = context.env;
  try {
    const form = await context.request.formData();
    const file = form.get("file");

    if (!file) return new Response("Missing file", { status: 400 });

    const buffer = await file.arrayBuffer();

    await R2.put(file.name, buffer, {
      httpMetadata: { contentType: file.type }
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Upload error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}