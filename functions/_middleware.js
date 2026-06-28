export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Pokud cesta začíná na /article/ a má UUID (není to /article.html)
  if (url.pathname.startsWith('/article/') && url.pathname !== '/article.html') {
    // Naservíruj article.html, ale zachovej původní URL
    return context.env.ASSETS.fetch(
      new Request(
        new URL('/article.html', context.request.url),
        context.request
      )
    );
  }
  
  // Jinak pokračuj normálně
  return context.next();
}
