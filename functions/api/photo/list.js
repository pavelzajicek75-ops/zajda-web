export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const bucket = env.zajda_photos;
    const prefix = 'photos/meta/';
    const listed = await bucket.list({ prefix });
    
    const photos = [];
    for (const obj of listed.objects) {
      const key = obj.key;
      const filename = key.replace(prefix, '');
      if (!filename) continue;
      
      // Get metadata
      const metaObj = await bucket.get(key);
      let meta = {};
      if (metaObj) {
        try {
          meta = JSON.parse(await metaObj.text());
        } catch (e) {}
      }
      
      // Get sizes for each version
      const sizes = {};
      const versions = ['original', '2000px', 'fullhd', '1024px', 'thumb'];
      for (const ver of versions) {
        const path = `photos/${ver === 'original' ? 'original' : ver}/${filename.replace(/\.[^.]+$/, ver === 'thumb' ? '.webp' : (ver === 'original' ? '' : '.webp'))}`;
        try {
          const vObj = await bucket.head(path);
          if (vObj) sizes[ver] = vObj.size;
        } catch (e) {}
      }
      
      photos.push({
        filename,
        meta,
        sizes,
        updated: obj.uploaded
      });
    }
    
    return new Response(JSON.stringify({ photos, count: photos.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
