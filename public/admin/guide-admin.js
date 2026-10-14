/* 📖 Příručka správce — stručně, jak věci fungují a co dělat, když něco nejde. */
(function () {
  'use strict';
  var SECTIONS = [
    ['✍️ Jak vydat článek', [
      'Články → napiš nadpis a text, vyber titulní fotku a štítky → Uložit. Před zveřejněním se zobrazí kontrola (fotka, štítky, perex) — dá se přeskočit.',
      'Stav: Koncept (vidíš jen ty), Zveřejněný, Naplánovaný (zveřejní se sám v daný čas), Neveřejný odkaz (jen pro toho, kdo má adresu).',
      'Po zveřejnění se nabídne poslání upozornění čtenářům a sdílení odkazu. U naplánovaných článků upozornění pošli ručně v Admin → Oznámit nový článek.',
      'Zvuk nebo video vložíš tlačítkem „🎧 Zvuk/video“ v editoru (YouTube odkaz nebo https odkaz na mp3/mp4).'
    ]],
    ['🖼️ Nahrávání fotek', [
      'Fotky nahrávej v Galeriích nebo přímo v editoru. Vždy se vytvoří i malý náhled, který čtenářům na mobilu zrychlí načítání.',
      'Když jsou staré fotky bez náhledu: Nástroje → Náhledy fotek → doplnit.',
      'Fotka se nenahrála? Zkus menší soubor (do pár MB) a obnov stránku. Opakuje-li se to, podívej se do Nástroje → Chyby.'
    ]],
    ['💾 Zálohy a obnova', [
      'Automatická záloha běží každý týden do úložiště R2 (složka backups/). Ručně: Nástroje → Zálohy → Zálohovat teď.',
      '„Stáhnout zálohu“ uloží soubor do tvého počítače — dělej to aspoň jednou za měsíc (admin ti to připomene).',
      'Obnova: Nástroje → Obnova ze zálohy → vyber soubor nebo zálohu z R2 → potvrď. Obnova přepíše současná data, proto před ní udělej čerstvou zálohu.',
      'Historie verzí článku: v editoru tlačítko „🕘 Historie verzí“ — uchovává posledních 10 uložených verzí.'
    ]],
    ['🔑 Tokeny a tajné hodnoty', [
      'ADMIN_PASSWORD — heslo do administrace. Nikomu ho neposílej.',
      'CF_API_TOKEN — token Cloudflare s právem „Account Analytics: Read“; slouží jen k zobrazení spotřeby KV v Přehledech.',
      'CF_ACCOUNT_ID_KV — číslo tvého účtu Cloudflare (taky jen pro Přehledy). Obojí se nastavuje v Cloudflare → projekt → Settings → Variables and Secrets jako Secret.',
      'Klíče pro upozornění (VAPID) si web vytvoří sám při prvním použití. Nemaž klíč meta:vapid, jinak by se čtenáři museli znovu přihlásit k upozorněním.'
    ]],
    ['🔔 Upozornění', [
      'Čtenáři si je zapnou na stránce „Sleduj blog“. Na iPhonu musí mít blog přidaný na plochu.',
      'Pro sebe je zapneš v Admin → Upozornění pro mě. Zazvoní ti nový komentář i zpráva „Napiš mi“. Zapni to na každém zařízení zvlášť.',
      'Když upozornění nechodí: zkontroluj povolení v nastavení prohlížeče a že zařízení není v úsporném režimu.'
    ]],
    ['📊 Limity Cloudflare (zdarma)', [
      'Za den: 100 000 čtení, 1 000 zápisů, 1 000 výpisů. Den se počítá v UTC (v Česku se nuluje ve 2:00 letního / 1:00 zimního času).',
      'Přehledy → Spotřeba KV ukazuje, kolik z limitu je vyčerpáno. Nad 70 % se zobrazí varování.',
      'Při vysoké návštěvnosti web počítá zobrazení „na vzorku“, aby limit nepřekročil. Čísla pak mohou být zaokrouhlená.',
      'Když limit dojde, zápisy (komentáře, lajky) se dočasně nepovedou; čtení z mezipaměti dál funguje. Ráno se vše vrátí.'
    ]],
    ['🆘 Když se něco pokazí', [
      'Nejdřív Nástroje → Diagnostika (selftest) — ukáže, co nefunguje.',
      'Něco vypadá staře? Admin → Vyprázdnit mezipaměť; ve svém prohlížeči pomůže tvrdé obnovení stránky.',
      'Špatně uložený článek: Historie verzí. Smazaný nebo rozbitý obsah: Obnova ze zálohy.',
      'Nahlášené chyby ze stránek najdeš v Nástroje → Chyby.'
    ]]
  ];
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function mount() {
    var host = document.getElementById('admin'); if (!host || document.getElementById('guideBox')) return;
    var box = document.createElement('div'); box.id = 'guideBox'; box.style.cssText = 'margin:0 0 2rem';
    var h = '<h3 style="margin-bottom:.5rem">📖 Příručka správce</h3>';
    SECTIONS.forEach(function (s) {
      h += '<details style="margin:.35rem 0;padding:.5rem .75rem;border:1px solid var(--border,#2a2d4a);border-radius:8px"><summary style="cursor:pointer;font-weight:600">' + esc(s[0]) + '</summary><ul style="margin:.5rem 0 .2rem 1.1rem;line-height:1.55;font-size:14px">' +
        s[1].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>';
    });
    box.innerHTML = h; host.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
