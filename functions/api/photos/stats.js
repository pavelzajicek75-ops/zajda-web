export async function onRequestGet(context) {
  const { env } = context;
  let totalSize = 0, totalCount = 0, cursor;
  do { const list = await env.PHOTOS_R2.list({ cursor, limit: 1000 }); for (const o of list.objects || []) { totalSize += o.size; totalCount++; } cursor = list.truncated ? list.cursor : undefined; } while (cursor);
  let galCount = 0, galSize = 0;
  const galList = await env.PHOTOS_R2.list({ prefix: 'gallery-main/' });
  for (const o of galList.objects || []) { galCount++; galSize += o.size; }
  return Response.json({ totalCount, totalSize, galCount, galSize });
}
