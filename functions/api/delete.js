export async function onRequestPost(context) {
  const { R2 } = context.env;
  const data = await context.request.json();

  if (!data.keys || !Array.isArray(data.keys)) {
    return new Response("Missing keys[]", { status: 400 });
  }

  for (const key of data.keys) {
    await R2.delete(key);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
