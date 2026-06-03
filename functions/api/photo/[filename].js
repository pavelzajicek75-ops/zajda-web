// /functions/api/photo/[filename].js

export async function onRequestGet(context) {
    const bucket = context.env.zajda_photos;
    const { filename } = context.params;

    const object = await bucket.get(filename);
    if (!object) return new Response("Not found", { status: 404 });

    return new Response(object.body, {
        headers: {
            "Content-Type": object.httpMetadata?.contentType || "image/jpeg"
        }
    });
}

export async function onRequestPut(context) {
    const bucket = context.env.zajda_photos;
    const { filename } = context.params;

    const arrayBuffer = await context.request.arrayBuffer();

    await bucket.put(filename, arrayBuffer, {
        httpMetadata: { contentType: "image/jpeg" }
    });

    return new Response("OK");
}

export async function onRequestDelete(context) {
    const bucket = context.env.zajda_photos;
    const { filename } = context.params;

    await bucket.delete(filename);
    return new Response("OK");
}
