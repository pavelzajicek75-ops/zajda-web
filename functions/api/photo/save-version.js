// GET handler – aby curl nevracel 404
export async function onRequestGet() {
  return new Response("Missing file or name", { status: 400 });
}

// POST handler – hlavní funkce pro ukládání verzí fotek
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // Ověření R2 bindingu
    if (!env.zajda_photos) {
      return new Response("R2 binding 'zajda_photos' is missing", { status: 500 });
    }

    // Načtení form-data
    const form = await request.formData();
    const file = form.get("file");
    const name = form.get("name");
    const version = form.get("version") || "original";

    // Validace
    if (!file || !name) {
      return new Response("Missing file or name", { status: 400 });
    }

    // Převod souboru na ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Cesta v R2
    const key = `versions/${name}/${version}.jpg`;

    // Uložení do R2
    await env.zajda_photos.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || "image/jpeg"
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        saved: key
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
