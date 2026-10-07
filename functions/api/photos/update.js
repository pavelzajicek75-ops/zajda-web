import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const thumb = formData.get('thumb'); // volitelné — viz saveEditor() v dashboard-editor.js
    const galleryId = formData.get('galleryId') || 'main';
    const oldKey = formData.get('oldKey');
    const mode = formData.get('mode') || 'replace';
    if (!file || typeof file === 'string') return Response.json({ error: 'No file' }, { status: 400 });

    let key;
    if (mode === 'replace' && oldKey) {
      // ★ OPRAVA: "Přepsat originál" musí zůstat na STEJNÉM klíči jako
      // oldKey — jinak se nová fotka odpojí od všech míst, co už na
      // starý klíč odkazují (vložené v textu článku, nastavené jako
      // titulní fotka...). Dřív se tu vytvářel nový náhodný klíč a starý
      // se smazal, takže upravená fotka sice reálně vznikla v R2, ale
      // nikde ve skutečnosti použitá nebyla — vypadalo to jako "neuložilo
      // se to", protože článek dál ukazoval (teď už smazaný) starý klíč.
      key = oldKey;
    } else {
      const id = crypto.randomUUID();
      const ext = (file.name || 'jpg').split('.').pop() || 'jpg';
      key = `gallery-${galleryId}/${id}.${ext}`;
    }

    const buffer = await file.arrayBuffer();
    await env.PHOTOS_R2.put(key, buffer, { httpMetadata: { contentType: file.type || 'image/jpeg' } });

    if (thumb && typeof thumb !== 'string') {
      try {
        const thumbBuffer = await thumb.arrayBuffer();
        await env.PHOTOS_R2.put(`thumbs/${key}`, thumbBuffer, { httpMetadata: { contentType: thumb.type || 'image/jpeg' } });
      } catch (thumbErr) {
        console.error('Uložení náhledu selhalo:', thumbErr);
      }
    }
    const id = key.split('/').pop().split('.')[0];
    return Response.json({ id, key, url: `/api/photos/file?key=${encodeURIComponent(key)}`, name: file.name, size: file.size, uploaded: new Date().toISOString() });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
