export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const file = url.searchParams.get("file");
  if (!file) {
    return new Response("Missing file parameter", { status: 400 });
  }
  await env.PHOTOS.delete(file);
  return new Response(JSON.stringify({ success: true, file }), {
    headers: { "Content-Type": "application/json" }
  });
}
