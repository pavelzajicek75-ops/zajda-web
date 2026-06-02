export async function onRequestGet(context) {
    const bucket = context.env.zajda_photos;
    const { filename } = context.params;

    const object = await bucket.get(filename);
    if (!object) return new Response("Not found", { status: 404 });

    return new Response(object.body, {
        headers: { "Content-Type": object.httpMetadata?.contentType || "image/jpeg" }
    });
}

export async function onRequestPut(context) {
    const bucket = context.env.zajda_photos;
    const { filename } = context.params;

    const data = await context.request.arrayBuffer();

    await bucket.put(filename, data, {
        httpMetadata: { contentType: "image/jpeg" }
    });

    return new Response("OK");
}
