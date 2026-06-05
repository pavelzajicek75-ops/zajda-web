// /functions/api/photo/[filename].js

export async function onRequest(context) {
  const { params, env } = context;
  const bucket = env.zajda_photos;

  const file = await bucket.get(params.filename);

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(file.body, {
    headers: {
      "Content-Type": file.httpMetadata?.contentType || "image/jpeg"
    }
  });
}
