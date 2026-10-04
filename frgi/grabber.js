/* frgi grabber: runs in YOUR browser tab on pinterest.com.
   1st click: starts recording every pin card you scroll past (Pinterest's grid
   is virtualised, so cards are captured as they mount, before they unmount).
   Next clicks: exports everything recorded so far as frgi-capture-<time>.json.
   On a pin page it also records the pin's own JSON-LD and video file links,
   and links the pins in "More to explore" to it as leads (graph edges). */
(function () {
  var S = window.__frgi;
  function pinId(href) { var m = /\/pin\/(\d{6,25})/.exec(href || ''); return m ? m[1] : null; }
  function pageInfo() {
    var u = new URL(location.href), p = u.pathname, kind = 'other', landed = pinId(p);
    if (landed) kind = 'pin';
    else if (p.indexOf('/search/') === 0) kind = 'search';
    else if (p === '/' || p.indexOf('/homefeed') === 0) kind = 'home';
    else if (p.split('/').filter(Boolean).length === 2) kind = 'board';
    return { url: location.href, kind: kind, query: u.searchParams.get('q'), landed_pin: landed, at: new Date().toISOString() };
  }
  function pinDetail() {
    var d = { ld: [], mp4: [], vtt: [] };
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      try { d.ld.push(JSON.parse(s.textContent)); } catch (e) {}
    });
    var html = document.documentElement.innerHTML;
    var re = /https:\/\/v1\.pinimg\.com\/videos\/[^"'\\\s]+?\.(mp4|vtt)/g, m, seen = {};
    while ((m = re.exec(html))) { if (!seen[m[0]]) { seen[m[0]] = 1; d[m[1]].push(m[0]); } }
    ['description', 'auto_alt_text', 'closeup_unified_description', 'grid_title', 'seo_title'].forEach(function (k) {
      var r = new RegExp('"' + k + '":"((?:[^"\\\\]|\\\\.){1,2000})"').exec(html);
      if (r) { try { d[k] = JSON.parse('"' + r[1] + '"'); } catch (e) {} }
    });
    var og = document.querySelector('meta[property="og:title"]'); if (og) d.og_title = og.content;
    return d;
  }
  function readCard(a) {
    var id = pinId(a.getAttribute('href')); if (!id) return null;
    var card = a.closest('[data-grid-item],[data-test-id="pin"],[role="listitem"]') || a.parentElement;
    var img = card && card.querySelector('img');
    var text = card ? card.innerText || '' : '';
    var dur = /(^|\n)(\d{1,2}:\d{2})(\n|$)/.exec(text);
    var creatorA = card && card.querySelector('a[href^="/"]:not([href*="/pin/"])');
    return {
      id: id, url: 'https://www.pinterest.com/pin/' + id + '/',
      title: (a.getAttribute('aria-label') || '').trim(),
      alt: img ? img.alt : '', img: img ? (img.currentSrc || img.src) : '',
      card_text: text.slice(0, 400),
      is_video: !!(dur || (card && card.querySelector('video'))), duration: dur ? dur[2] : null,
      creator_path: creatorA ? creatorA.getAttribute('href') : null
    };
  }
  function scan() {
    var page = S.page();
    document.querySelectorAll('a[href*="/pin/"]').forEach(function (a) {
      var c = readCard(a); if (!c || c.id === page.landed_pin) return;
      var old = S.pins[c.id] || { seen_on: [] };
      for (var k in c) if (c[k] && !old[k]) old[k] = c[k];
      if (old.seen_on.indexOf(page.url) < 0) old.seen_on.push(page.url);
      S.pins[c.id] = old;
    });
    if (page.landed_pin && !S.details[page.landed_pin]) S.details[page.landed_pin] = pinDetail();
    if (!S.pages[page.url]) S.pages[page.url] = page;
  }
  if (!S) {
    S = window.__frgi = { pins: {}, pages: {}, details: {}, page: pageInfo };
    var t = null;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 250); })
      .observe(document.body, { childList: true, subtree: true });
    var last = location.href;
    setInterval(function () { if (location.href !== last) { last = location.href; setTimeout(scan, 1200); } }, 500);
    scan();
    alert('frgi: recording. Scroll, search and open pins as normal. Click the bookmarklet again to export.');
    return;
  }
  scan();
  var out = { tool: 'frgi-grabber', version: 1, exported_at: new Date().toISOString(),
    pages: Object.values(S.pages), details: S.details, pins: Object.values(S.pins) };
  var blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'frgi-capture-' + Date.now() + '.json'; document.body.appendChild(a); a.click(); a.remove();
  alert('frgi: exported ' + out.pins.length + ' pins from ' + out.pages.length + ' pages. Still recording.');
})();
