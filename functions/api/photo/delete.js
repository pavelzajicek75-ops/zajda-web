export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  
  try {
    const bucket = env.zajda_photos;
    const body = await request.json();
    const filenames = body.filenames || [];
    
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No filenames' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    for (const filename of filenames) {
      const baseName = filename.replace(/\.[^.]+$/, '');
      const keys = [
        `photos/original/${filename}`,
        `photos/2000px/${baseName}.webp`,
        `photos/fullhd/${baseName}.webp`,
        `photos/1024px/${baseName}.webp`,
        `photos/thumbs/${baseName}.webp`,
        `photos/meta/${filename}.json`
      ];
      
      for (const key of keys) {
        try { await bucket.delete(key); } catch (e) {}
      }
    }
    
    return new Response(JSON.stringify({ success: true, deleted: filenames.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
