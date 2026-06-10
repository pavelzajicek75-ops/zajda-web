export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  
  try {
    const bucket = env.zajda_photos;
    const formData = await request.formData();
    
    const original = formData.get('original');
    if (!original) {
      return new Response(JSON.stringify({ success: false, error: 'No original file' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    const filename = original.name;
    const baseName = filename.replace(/\.[^.]+$/, '');
    
    // Save original
    await bucket.put(`photos/original/${filename}`, original.stream(), {
      httpMetadata: { contentType: original.type }
    });
    
    // Save versions if provided
    const versions = [
      { key: '2000px', ext: '.webp', path: `photos/2000px/${baseName}.webp` },
      { key: 'fullhd', ext: '.webp', path: `photos/fullhd/${baseName}.webp` },
      { key: '1024px', ext: '.webp', path: `photos/1024px/${baseName}.webp` },
      { key: 'thumb', ext: '.webp', path: `photos/thumbs/${baseName}.webp` }
    ];
    
    const sizes = { original: original.size };
    
    for (const ver of versions) {
      const file = formData.get(ver.key);
      if (file) {
        await bucket.put(ver.path, file.stream(), {
          httpMetadata: { contentType: 'image/webp' }
        });
        sizes[ver.key] = file.size;
      }
    }
    
    // Metadata
    const metadata = {
      filename,
      width: 0,
      height: 0,
      sizes,
      exif: {},
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    
    await bucket.put(`photos/meta/${filename}.json`, JSON.stringify(metadata), {
      httpMetadata: { contentType: 'application/json' }
    });
    
    return new Response(JSON.stringify({ success: true, filename }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
