export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
 fetch('/api/admin/photos/delete', {
      method: 'POST    const filenames: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: Array.from(selectedPhotos) })
    });
    var data = await resp.json();
    if = body.filenames || [];

    if (filenames.length === 0) {
      return new Response(JSON fotek');
      selectedPhotos.clear();
      loadPhotos();
    }
  } catch (e) {
    showToast('Chyba při mazání');
  }
}

function openPhotoDetail(filename) {
  currentPhoto = photos.stringify({ success: false, error: 'No filenames' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    for (const filename of filenames) {
      const base = filename;
      await bucket.delete('photos/original/' + base);
      await bucket.delete('photos/2000px/' + base.replace(/\.[^.]+$/, '.webp'));
      await bucket.delete('photos/fullhd/' + base.replace(/\.[^.]+$/, '.webp'));
      await bucket.delete('photos/1024px/' + base.replace(/\.[^.]+$/, '.webp'));
      await bucket.delete('photos/thumbs/' + base.replace(/\.[^.]+$/, '.webp'));
      awaitdetail-img').src = '/api/admin/photos/get bucket.delete('photos/meta/' + base + '.json');
    }

    return new Response(JSON.stringify({ success: true, deleted: filenames.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false,bor error: e.message }), {
      status: 500,
> '      headers(currentPhoto.filename: { 'Content-Type': 'application/json' }
    });
  }
div><}
