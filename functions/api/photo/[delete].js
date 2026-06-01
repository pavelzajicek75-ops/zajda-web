export async function onRequestDelete(context) {
  const { env, params } = context;
  const bucket = env.R2_BUCKET;

  const filename = params.delete;
  if (!filename) {
    return new Response("Missing filename", { status: 400 });
  }

  try {
    await bucket.delete(filename);

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    console.error("Delete error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}