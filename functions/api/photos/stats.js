export async function onRequestGet(context) {
  const { env } = context;
  
  if (!env.PHOTOS_R2) {
    return Response.json({ error: 'PHOTOS_R2 not bound' }, { status: 500 });
  }

  try {
    const list = await env.PHOTOS_R2.list();
    const objects = list.objects || [];
    
    let totalSize = 0;
    for (const obj of objects) totalSize += obj.size;
    
    let sizeText;
    if (totalSize < 1024) sizeText = totalSize + ' B';
    else if (totalSize < 1024 * 1024) sizeText = (totalSize / 1024).toFixed(1) + ' KB';
    else if (totalSize < 1024 * 1024 * 1024) sizeText = (totalSize / (1024 * 1024)).toFixed(1) + ' MB';
    else sizeText = (totalSize / (1024 * 1024 * 1024)).toFixed(2) + ' GB';

    return Response.json({
      count: objects.length,
      totalSize,
      sizeText
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
