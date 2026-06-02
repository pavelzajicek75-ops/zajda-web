export async function onRequest(context) {
    const bucket = context.env.zajda_photos;
    const { filename } = context.params;

    await bucket.delete(filename);

    return new Response("OK");
}
