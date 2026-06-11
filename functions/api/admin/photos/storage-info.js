export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    let totalSize = 0;
    let count = 0;
    let cursor = undefined;

    do {
      const listed = await bucket.list({ cursor, limit: 1000 });
      for (const obj of listed.objects || []) {
        totalSize += obj.size;
        count++;
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    const formatSize = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return new Response(JSON.stringify({
      count,
      totalSize,
      totalSizeFormatted: formatSize(totalSize)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, count: 0, totalSize: 0 }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
