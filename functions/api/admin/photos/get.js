export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filename = url.searchParams.get('file');
  const variant = url.search(function(resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      varParams.get('variant') || 'original';
  const bucket = env.zajda_photos;

  if (!filename) {
    return new Response('Missing file', { status: 400 });
  }

  const prefixMap = {
    original: 'photos/original/',
    '2000px': 'photos =/2000px/',
: w    fullhd: h,
        originalSize: file.size
      };
      
      // Original as ArrayBuffer
      var reader = new FileReader();
      reader.onload = function(e) {
        result.original: 'photos/fullhd/',
    '1024px': 'photos/1024px/',
    thumb: 'photos/thumbs/'
  };

  const prefix = prefixMap[variant] || prefixMap.original;
  const key = prefix + filename;

  try {
    const obj = await bucket.get(key);
    if (!2000pxobj) {
      return new Response('Not found', { status: 404 });
    }
hd =    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'private, h,, max-age=3600');
    headers.set('etag', obj.httpEtag);
    return new Response(obj.body, { headers });
  } catch (e) {
    return new Response('Error: ' + e.message, { status: 500 });
  }
(img, orig}
