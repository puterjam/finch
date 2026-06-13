(function () {
  'use strict';

  var PATH = window.location.pathname;
  var IS_EN = PATH.indexOf('/en/') === 0;

  // ---- Redirect to the other language version ----
  function otherLangUrl() {
    var search = window.location.search;
    var hash = window.location.hash;

    if (IS_EN) {
      // en → zh: strip /en/ prefix
      if (PATH === '/en/' || PATH === '/en') return '/' + search + hash;
      return PATH.replace(/^\/en\//, '/') + search + hash;
    }

    // zh → en: add /en/ prefix
    if (PATH === '/' || PATH === '' || PATH.slice(-10) === '/index.html') return '/en/' + search + hash;
    if (PATH.slice(-5) === '.html') return '/en/' + PATH.slice(1) + search + hash;
    return '/en/' + PATH.slice(1) + search + hash;
  }

  // ---- Auto-detect and redirect ----
  var manualChoice = localStorage.getItem('finch-language-preference');

  if (IS_EN) {
    if (manualChoice === 'zh') { window.location.href = otherLangUrl(); return; }
    if (manualChoice === 'en') { /* explicit choice, stay */ }
    else {
      var primaryLang = (navigator.languages && navigator.languages[0] || navigator.language || navigator.userLanguage || '').toLowerCase();
      if (!primaryLang.startsWith('en')) { window.location.href = otherLangUrl(); return; }
    }
  } else {
    if (manualChoice === 'en') { window.location.href = otherLangUrl(); return; }
    if (manualChoice === 'zh') { /* explicit choice, stay */ }
    else {
      var primaryLang2 = (navigator.languages && navigator.languages[0] || navigator.language || navigator.userLanguage || '').toLowerCase();
      if (primaryLang2.startsWith('en')) { window.location.href = otherLangUrl(); return; }
    }
  }

  // ---- Save manual language switch clicks ----
  document.addEventListener('click', function (e) {
    var link = e.target.closest('.lang-switcher a');
    if (!link) return;
    var href = link.getAttribute('href');
    localStorage.setItem('finch-language-preference', href.indexOf('/en/') === 0 ? 'en' : 'zh');
  });
})();
