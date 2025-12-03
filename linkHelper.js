// linkHelper.js

const LinkHelper = {
  /**
   * Membuka URL di tab baru.
   * Menggunakan chrome.tabs.create memastikan session (cookies) terbawa.
   * @param {string} url - URL tujuan
   * @param {boolean} active - Apakah tab langsung difokuskan? (Default: true)
   */
  open: (url, active = true) => {
    if (!url) return;
    
    chrome.tabs.create({ url: url, active: active });
  },

  /**
   * Mengubah elemen DOM biasa menjadi elemen yang bisa diklik.
   * Berguna untuk tombol kustom atau elemen div/span.
   * @param {HTMLElement} element - Elemen HTML
   * @param {string} url - URL tujuan
   */
  attach: (element, url) => {
    if (!element || !url) return;

    element.style.cursor = 'pointer';
    element.title = "Buka di tab baru (Session terjaga)";
    
    element.addEventListener('click', (e) => {
      e.preventDefault(); // Mencegah perilaku default
      e.stopPropagation(); // Mencegah event bubbling
      LinkHelper.open(url);
    });
  }
};