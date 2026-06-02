export async function onRequestDelete({ params, env }) {
  const { filename } = params;
  const bucket = env.zajda_photos;

  if (!filename) {
    return new Response(JSON.stringify({ success: false, error: "Missing filename" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await bucket.delete(filename);
    return new Response(JSON.stringify({ success: true, deleted: filename }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

