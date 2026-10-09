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
