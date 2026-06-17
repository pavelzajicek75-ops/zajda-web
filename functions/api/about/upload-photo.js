export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return Response.json({ error: 'Chybí soubor' }, { status: 400 });
  const id = crypto.randomUUID();
  const key = `about/${id}.${file.name.split('.').pop()}`;
  await env['zajda-photos'].put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = env.CDN_BASE_URL ? `${env.CDN_BASE_URL}/${key}` : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${key}`;
  return Response.json({ url, key });
}
