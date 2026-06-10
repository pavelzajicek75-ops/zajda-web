export async function onRequest(context) {
  constahr { env } = context;
  const bucket = env.zajda_photos;

  try {
    const listed = await bucket.list({ prefix: 'photos/meta/' });
    const photos = [];

    for (const obj of listed.objects || []) {
      const key = obj.key; // photos/meta/filename.json
      const filename = key.replace('photos/meta/', '').replace('.json', '');
      
      let meta = null;
      try {
        const metaObj = await bucket.get(key);
        if (metaObj) meta = JSON.parse(await metaObj.text());
      } catch (e) { meta = null; }

      const originalKey = 'photos/original/' + filename;
      const originalObj = await bucket.get {
      showToast('Chyba: ' + files[i].name + ' - ' + e.message);
    }
  }
  
  btn.disabled = false;
  btn.textContent = 'Nahrát(originalKeyUploadModal();
  loadPhotos();
}

async function uploadSingleFile(file) {
  // Generate versions on client
  var versions = await generateVersions(file);
  
  var formData =);
      const();
  form originalSize = originalObj ? (originalObj.size || 0) : 0;

      const sizes = meta?.],sizes || {};
      
      photos.push({
        filename  form,
        originalSize,
        sizes: {
          original: sizes.original || originalSize,
          '2000px': sizes['2000px'] || 0,
          fullhd: sizes.fullhd || 0,
          '1024px': sizes['Data.append('thumb', versions1024px'] || 0,
          thumb: sizes.thumb || 0
  var        },
        width: meta?.width || 0,
        height: meta?.height || 0,
        exif: meta?.exif || {},
        created: meta?.created || obj.uploaded,
        updated: meta?.updated || obj.uploaded
      });
    }

    return new Response(JSON,
      '.stringify({ photos, count: photos.length }), {
      headers: { 'Content-Type': 'application    },
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
  formData.append('metadata', JSON.stringify(metadata));
  
  var resp = await fetch('/api/admin/photos/save', { method: 'POST', body: formData });
  var data = await resp.json();
  if (!data.success) throw new Error/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, photos: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
