export async function onRequestGet(context) {
  const { env } = context;
  const result = {
    photos: [],
    quotes: []
  };

  try {
    const photosList = await env['zajda-photos'].list();
    result.photos = (photosList.objects || []).slice(0, 20).map(o => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded
    }));
  } catch (e) {
    result.photosError = e.message;
  }

  try {
    const quotesList = await env['zajda-quotes'].list();
    result.quotes = [];
    for (const obj of (quotesList.objects || []).slice(0, 20)) {
      try {
        const data = await env['zajda-quotes'].get(obj.key);
        let content = null;
        try {
          content = await data.json();
        } catch {
          content = await data.text();
        }
        result.quotes.push({
          key: obj.key,
          size: obj.size,
          content: content
        });
      } catch (e) {
        result.quotes.push({ key: obj.key, error: e.message });
      }
    }
  } catch (e) {
    result.quotesError = e.message;
  }

  try {
    const sectionsList = await env.SECTIONS.list();
    result.sections = [];
    for (const key of (sectionsList.keys || []).slice(0, 20)) {
      const data = await env.SECTIONS.get(key.name, { type: 'json' });
      result.sections.push({ key: key.name, data });
    }
  } catch (e) {
    result.sectionsError = e.message;
  }

  try {
    const subsectionsList = await env.SUBSECTIONS.list();
    result.subsections = [];
    for (const key of (subsectionsList.keys || []).slice(0, 20)) {
      const data = await env.SUBSECTIONS.get(key.name, { type: 'json' });
      result.subsections.push({ key: key.name, data });
    }
  } catch (e) {
    result.subsectionsError = e.message;
  }

  return Response.json(result, { headers: { 'Content-Type': 'application/json' } });
}
