export async function onRequestPost(context) {
  const { request, env } = context;
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return new Response("Missing file", { status: 400 });
  }
  const fileName = file.name || `photo-${Date.now()}`;
  await env.PHOTOS.put(fileName, file.stream(), {
    httpMetadata: { contentType: file.type }
  });
  return new Response(JSON.stringify({ success: true, fileName }), {
    headers: { "Content-Type": "application/json" }
  });
}
