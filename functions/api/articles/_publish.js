// Pomocník pro plánované publikování.
// Článek s published === false a vyplněným publishAt (ISO čas) se po
// uplynutí tohoto času automaticky tváří jako publikovaný — žádný cron,
// žádné zápisy do KV, rozhodne se při každém čtení.
export function applySchedule(article, now = Date.now()) {
  if (article && article.published === false && article.publishAt) {
    const t = Date.parse(article.publishAt);
    if (Number.isFinite(t) && t <= now) return { ...article, published: true };
  }
  return article;
}
export function isPublished(article) {
  return !!article && article.published !== false;
}

// Veřejně vypsaný článek = publikovaný a ne "jen přes odkaz".
export function isListed(article) {
  return isPublished(article) && !article.unlisted;
}

// Náhodný tajný token do soukromého odkazu (24 hex znaků).
export function newShareToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '').slice(0, 24);
}
