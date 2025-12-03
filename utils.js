// utils.js
window.AppUtils = {
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  shuffleArray: (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  updateStatus: (text, color) => {
    const el = window.AppState.UI.statusMsg;
    if (el) {
      el.innerText = text;
      el.style.color = color;
    }
  },

  updateAutoUI: (running) => {
    const UI = window.AppState.UI;
    UI.btnAutoStart.disabled = running;
    UI.btnAutoStop.disabled = !running;
    UI.btnScrape.disabled = running;
    UI.btnExport.disabled = running;
  },

  extractUsername: (urlString) => {
    try {
      const url = new URL(urlString);
      const segments = url.pathname.split('/');
      if (segments.length > 1 && segments[1]) return segments[1];
      return "-";
    } catch (e) { return "-"; }
  },

  parseShopData: (combinedString) => {
    if (!combinedString) return { name: "-", location: "-" };
    const parts = combinedString.split(" - ");
    if (parts.length === 1) return { name: parts[0], location: "-" };
    const location = parts.pop();
    const name = parts.join(" - ");
    return { name, location };
  },

  detectPageType: (urlString) => {
    try {
      const url = new URL(urlString);
      const path = url.pathname;
      if (path.startsWith('/search')) return { code: 'search', label: "🔍 Pencarian" };
      if (/\/[\w\-\.]+\/(product|etalase)/i.test(path)) return { code: 'shop_list', label: "🏪 Toko" };
      return { code: 'other', label: "📄 Tokopedia" };
    } catch (e) { return { code: 'unknown', label: "?" }; }
  },

  setIndicator: (text, bg, color, border) => {
    const el = window.AppState.UI.pageTypeIndicator;
    if (el) {
      el.innerText = text;
      el.style.backgroundColor = bg;
      el.style.color = color;
      el.style.borderColor = border;
    }
  },

  updatePageIndicator: (url) => {
    if (!url.includes('tokopedia.com')) {
      AppUtils.setIndicator("❌ Bukan Halaman Tokopedia", "#ffebee", "#c62828", "#ffcdd2");
      if (window.AppState.UI.btnScrape) window.AppState.UI.btnScrape.disabled = true;
      return;
    }
    
    if (window.AppState.UI.btnScrape) window.AppState.UI.btnScrape.disabled = false;
    const type = AppUtils.detectPageType(url);
    
    // Logic warna indikator
    let colors = { bg: "#f5f5f5", txt: "#616161", border: "#e0e0e0" };
    if (type.code === 'search') colors = { bg: "#fff3e0", txt: "#e65100", border: "#ffe0b2" };
    else if (type.code === 'shop_list') colors = { bg: "#e8f5e9", txt: "#1b5e20", border: "#c8e6c9" };
    else if (type.code === 'pdp') colors = { bg: "#e3f2fd", txt: "#0d47a1", border: "#bbdefb" };

    AppUtils.setIndicator(type.label, colors.bg, colors.txt, colors.border);
  }
};