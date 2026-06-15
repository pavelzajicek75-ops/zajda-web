// functions/api/quotes/delete.js
export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  await env.QUOTES_R2.delete(`quotes/${id}.json`);
  return Response.json({ success: true });
}
