export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const thumb = formData.get('thumb'); // volitelné — viz saveEditor() v dashboard-editor.js
    const galleryId = formData.get('galleryId') || 'main';
    const oldKey = formData.get('oldKey');
    const mode = formData.get('mode') || 'replace';
    if (!file || typeof file === 'string') return Response.json({ error: 'No file' }, { status: 400 });
    const id = crypto.randomUUID();
    const ext = (file.name || 'jpg').split('.').pop() || 'jpg';
    const key = `gallery-${galleryId}/${id}.${ext}`;
    const buffer = await file.arrayBuffer();
    await env.PHOTOS_R2.put(key, buffer, { httpMetadata: { contentType: file.type || 'image/jpeg' } });
    if (mode === 'replace' && oldKey) {
      try { await env.PHOTOS_R2.delete(oldKey); } catch {}
      try { await env.PHOTOS_R2.delete(`thumbs/${oldKey}`); } catch {} // úklid náhledu staré verze, ať nezůstává osiřelý v R2
    }
    if (thumb && typeof thumb !== 'string') {
      try {
        const thumbBuffer = await thumb.arrayBuffer();
        await env.PHOTOS_R2.put(`thumbs/${key}`, thumbBuffer, { httpMetadata: { contentType: thumb.type || 'image/jpeg' } });
      } catch (thumbErr) {
        console.error('Uložení náhledu selhalo:', thumbErr);
      }
    }
    return Response.json({ id, key, url: `/api/photos/file?key=${encodeURIComponent(key)}`, name: file.name, size: file.size, uploaded: new Date().toISOString() });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
