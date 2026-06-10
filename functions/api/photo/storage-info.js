export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  
  try {
    const bucket = env.zajda_photos;
    let totalSize = 0;
    let fileCount = 0;
    let truncated = true;
    let cursor = undefined;
    
    while (truncated) {
      const list = await bucket.list({ cursor });
      for (const obj of list.objects) {
        totalSize += obj.size;
        fileCount++;
      }
      truncated = list.truncated;
      cursor = list.cursor;
    }
    
    return new Response(JSON.stringify({
      fileCount,
      totalSize,
      totalSizeHuman: formatBytes(totalSize)
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
