// functions/og-image.js
//
// GET /og-image?title=...&section=...&image=...
//
// Vygeneruje PNG 1200×630 (standardní rozměr pro Open Graph / Twitter
// kartu) — titulní fotka článku na pozadí, tmavý gradient přes spodní
// část kvůli čitelnosti textu, a nahoře na gradientu název sekce +
// velký nadpis + jméno webu. Přesně to, co dělají velká média u svých
// sdílených odkazů, místo "jen fotky".
//
// Volá se z functions/article.js (ten sestaví URL s parametry a použije
// ji jako og:image / twitter:image).
//
// ⚠️ Nejtechničtější kus z celého webu — spoléhá na knihovnu `workers-og`
// (satori pod kapotou), musí být v package.json (viz "dependencies") a
// Cloudflare Pages musí při nasazení spustit "npm install". Pokud by
// generování z nějakého důvodu selhalo (chybějící font, WASM problém…),
// níže je fallback: přesměruje se rovnou na obyčejnou titulní fotku, ať
// sdílený odkaz aspoň nezůstane úplně bez náhledu.

import { ImageResponse } from 'workers-og';

/* Malý pomocník, ať se element-strom dá psát bez JSX (Pages Functions
   defaultně JSX nekompilují) — `el('div', {style:{...}}, dítě1, dítě2)`. */
function el(type, props, ...children) {
  const flatChildren = children.length <= 1 ? children[0] : children;
  return { type, props: { ...(props || {}), children: flatChildren } };
}

/* Stáhne font jen s glyfy, co se doopravdy použijí (Google Fonts CSS2 API
   umí subsetovat podle parametru "text") — funguje i na české diakritice,
   protože tu do "text" posíláme spolu se zbytkem. Trik se starším
   User-Agentem donutí Google vrátit .ttf/.woff místo .woff2, který
   satori (uvnitř workers-og) neumí načíst. */
async function loadGoogleFont(text, weight) {
  const cssUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@' + weight + '&text=' + encodeURIComponent(text);
  const cssRes = await fetch(cssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
    }
  });
  const css = await cssRes.text();
  const match = css.match(/src: url\(([^)]+)\)/);
  if (!match) throw new Error('Nepodařilo se najít URL fontu v CSS odpovědi Google Fonts');
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error('Nepodařilo se stáhnout soubor fontu');
  return await fontRes.arrayBuffer();
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const title = (url.searchParams.get('title') || 'Moje diagnóza, můj vesmír').slice(0, 140);
  const section = (url.searchParams.get('section') || '').slice(0, 40);
  const image = url.searchParams.get('image') || '';
  const siteTitle = 'Moje diagnóza, můj vesmír';

  try {
    const fontText = title + ' ' + section + ' ' + siteTitle + ' áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ';
    const fontData = await loadGoogleFont(fontText, 700);

    const tree = el('div', {
      style: {
        width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', position: 'relative',
        backgroundColor: '#08080f',
        backgroundImage: image
          ? 'url(' + image + ')'
          : 'linear-gradient(135deg, #1a1230 0%, #08080f 100%)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        fontFamily: 'Inter'
      }
    },
      // Tmavý gradient přes spodní ~60 % fotky — bez toho by text na
      // světlé fotce splýval a nešel by přečíst.
      el('div', {
        style: {
          position: 'absolute', inset: '0', display: 'flex',
          backgroundImage: 'linear-gradient(180deg, rgba(8,8,15,0.05) 0%, rgba(8,8,15,0.45) 50%, rgba(8,8,15,0.94) 100%)'
        }
      }),
      el('div', {
        style: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', padding: '64px 72px' }
      },
        section
          ? el('div', {
              style: {
                display: 'flex', color: '#2fe6c9', fontSize: '30px', fontWeight: 700,
                letterSpacing: '2px', textTransform: 'uppercase'
              }
            }, section)
          : null,
        el('div', {
          style: {
            display: 'flex', color: '#f8f5ef', fontSize: '58px', fontWeight: 700,
            lineHeight: 1.2, maxWidth: '1050px'
          }
        }, title),
        el('div', {
          style: { display: 'flex', color: '#b3b6da', fontSize: '26px', marginTop: '8px' }
        }, siteTitle)
      )
    );

    return new ImageResponse(tree, {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: fontData, weight: 700, style: 'normal' }]
    });
  } catch (e) {
    console.error('Generování OG obrázku selhalo, přesměrovávám na náhradní fotku:', e);
    const fallback = image || (url.origin + '/images/og-cover.jpg');
    return Response.redirect(fallback, 302);
  }
}
