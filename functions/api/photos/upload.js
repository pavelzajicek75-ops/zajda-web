export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const thumb = formData.get('thumb'); // volitelné — viz dashboard-core.js uploadOne()
    const galleryId = formData.get('galleryId') || 'main';
    if (!file || typeof file === 'string') return Response.json({ error: 'No file' }, { status: 400 });
    const id = crypto.randomUUID();
    const ext = (file.name || 'jpg').split('.').pop() || 'jpg';
    const key = `gallery-${galleryId}/${id}.${ext}`;
    const buffer = await file.arrayBuffer();
    await env.PHOTOS_R2.put(key, buffer, { httpMetadata: { contentType: file.type || 'image/jpeg' } });

    // Náhled se ukládá pod STEJNÝM klíčem, jen s prefixem "thumbs/" —
    // frontend (deriveThumbUrl v dashboard-core.js/shared.js) si tuhle
    // adresu umí sám dopočítat z plné URL, takže tu není potřeba
    // vracet žádné zvláštní pole navíc.
    if (thumb && typeof thumb !== 'string') {
      try {
        const thumbBuffer = await thumb.arrayBuffer();
        await env.PHOTOS_R2.put(`thumbs/${key}`, thumbBuffer, { httpMetadata: { contentType: thumb.type || 'image/jpeg' } });
      } catch (thumbErr) {
        // Náhled je jen bonus pro rychlost — selhání jeho uložení nemá
        // zablokovat úspěšně nahranou hlavní fotku.
        console.error('Uložení náhledu selhalo:', thumbErr);
      }
    }

    return Response.json({ id, key, url: `/api/photos/file?key=${encodeURIComponent(key)}`, name: file.name, size: file.size, uploaded: new Date().toISOString() });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
