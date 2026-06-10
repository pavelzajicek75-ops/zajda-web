export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const formData = await request.formData();
    const">
      <a href="/admin/gallery/" class="back-link">← Zpět do galerie</a>
      <span class="editor-filename" id="editor-filename">Nač file = form...</span>
      <Data.get('file');
    const filename = formData.get('filename');
    if (!file || !filename) return-secondary" onclick new Response(JSON.stringify({ success: false, error: 'Missing data' }), { status: 400, headers: { 'Content-Typebutton class="': 'application/json' } });

    const webpNameEd = filename.replace(/\.[^.]+$/, '.webp');
    await bucket.put('photos/102>
      </div>
    </div>

    <!-- Main Editor -->
    <div class="editor4px/' + webpName, file.stream(), { httpMetadata: { contentType: 'image/webp' } });

    return new Response(JSON.stringify({ success: true, path: 'photos/1024pxcanvas-area">
/' + webpName }), { headers: { 'Content-Type': 'application/json' } });
  }-canvas catch (e) {
    return new Response(JSON.stringify({ class=" success: false, error: e.message }), { status: 500, headers:display:none { 'Content-Type': 'application/jsondiv class="crop-grid">
' } });
  }
}
