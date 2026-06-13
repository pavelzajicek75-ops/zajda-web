export async function onRequestGet(context) {
  const { request, env } = context;
  
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const obj = await env.PHOTOS_R2.head(key);
  
  if (!obj) {
    return new Response(JSON.stringify({ error: "Not found" }), { 
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    httpEtag: obj.httpEtag,
    url: `${env.CDN_BASE_URL}/${obj.key}`
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
