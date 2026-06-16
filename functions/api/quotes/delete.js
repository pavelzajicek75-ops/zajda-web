export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!env.QUOTES_R2) {
    return Response.json({ error: 'R2 binding QUOTES_R2 není připojený.' }, { status: 500 });
  }

  if (!key) {
    return Response.json({ error: 'Chybí klíč souboru' }, { status: 400 });
  }
  
  await env.QUOTES_R2.delete(key);
  return Response.json({ success: true });
}
