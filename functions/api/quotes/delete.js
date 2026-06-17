export async function onRequestDelete(context) {
  const { request, env } = context;
  const r2 = env.QUOTES_R2;
  if (!r2) return Response.json({ error: 'Chybí QUOTES_R2' }, { status: 500 });
  
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) return Response.json({ error: 'Chybí klíč' }, { status: 400 });
  
  await r2.delete(key);
  return Response.json({ success: true });
}
