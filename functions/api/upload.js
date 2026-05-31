export async function onRequestPost(context) {
  const { R2 } = context.env;

  const formData = await context.request.formData();
  const file = formData.get("file");

  if (!file) {
    return new Response("Missing file", { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const key = file.name;

  await R2.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type }
  });

  return new Response(JSON.stringify({ success: true, key }), {
    headers: { "Content-Type": "application/json" }
  });
}
