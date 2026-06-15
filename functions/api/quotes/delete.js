export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  
  if (!key) {
    return Response.json({ error: 'Chybí klíč souboru' }, { status: 400 });
  }
  
  await env['zajda-quotes'].delete(key);
  return Response.json({ success: true });
}
