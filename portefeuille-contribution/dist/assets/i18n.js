(() => {
  const locale = document.documentElement.lang || 'fr';
  window.portfolioI18nReady = fetch(`locales/${locale}.json`, {cache: 'no-store'})
    .then(response => response.ok ? response.json() : {})
    .catch(() => ({}))
    .then(messages => {
      window.portfolioMessages = messages;
      window.t = (key, fallback = key) => messages[key] ?? fallback;
      document.querySelectorAll('[data-i18n]').forEach(node => {
        const key = node.dataset.i18n, attribute = node.dataset.i18nAttr;
        if (attribute) node.setAttribute(attribute, window.t(key, node.getAttribute(attribute)));
        else node.textContent = window.t(key, node.textContent);
      });
      return messages;
    });
})();
