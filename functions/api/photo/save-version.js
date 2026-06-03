export async function onRequestPost(context) {
  const env = context.env;

  const url = new URL(context.request.url);
  const type = url.searchParams.get("type");

  const form = await context.request.formData();
  const file = form.get("file");
  const name = form.get("name");

  if (!file || !name) {
    return new Response("Missing file or name", { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();

  await env.R2_PHOTOS.put(name, arrayBuffer, {
    httpMetadata: {
      contentType: "image/jpeg"
    }
  });

  return new Response("OK", { status: 200 });
}
