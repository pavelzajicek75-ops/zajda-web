// ============================================
// /functions/api/admin/photos/storage-info.js
// ============================================

export async function onRequest(context) {
  try {
    const { env } = context;

    const list = await env.PHOTOS_BUCKET.list();

    const total = list.objects.reduce((sum, obj) => sum + obj.size, 0);

    return new Response(
      JSON.stringify({
        count: list.objects.length,
        totalBytes: total
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
