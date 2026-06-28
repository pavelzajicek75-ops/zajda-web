export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Pokud je to /article/UUID, posloužíme article.html
  if (path.startsWith('/article/') && path !== '/article.html') {
    const response = await context.env.ASSETS.fetch(
      new Request(new URL('/article.html', context.request.url), context.request)
    );
    return response;
  }

  // Jinak pokračuj normálně
  return context.next();
}
