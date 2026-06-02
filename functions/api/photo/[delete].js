// rebuild trigger

export async function onRequestDelete(context) {
  const { env, params } = context;
  const bucket = env.R2_BUCKET;
  const filename = params.delete;

  if (!filename) {
    return new Response("Missing filename", { status: 400 });
  }

  try {
    await bucket.delete(filename);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response("Delete failed: " + err.message, { status: 500 });
  }
}
