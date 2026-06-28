export async function onRequest(context) {
  return context.env.ASSETS.fetch(
    new Request(
      new URL('/article.html', context.request.url),
      context.request
    )
  );
}
