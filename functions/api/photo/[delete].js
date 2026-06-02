export async function onRequestDelete({ params, env }) {
  const filename = params.filename;
  const bucket = env.zajda_photos;

  try {
    await bucket.delete(filename);
    return new Response(JSON.stringify({ success: true, deleted: filename }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
