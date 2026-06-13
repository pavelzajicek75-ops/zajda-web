export async function onRequestPost(context) {
  const { request, env } = context;
  
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { key } = body;
  
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  await env.PHOTOS_R2.delete(key);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
