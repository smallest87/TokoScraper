if (typeof window.SCRAPER_CONFIG === 'undefined') {
  window.SCRAPER_CONFIG = {
    // Selector container utama
    cardContainer: '.css-5wh65g', 

    // Pola Regex untuk deteksi teks (Harga, Rating, dll)
    patterns: {
      price: /^Rp\s?[\d\.]+/i,
      rating: /^[1-5]\.\d$/,
      sold: /(\d+[rbjt\+]?)\s+(terjual|sold)/i,
      discount: /^\d{1,2}%$/
    },

    // --- LOGIKA BARU: DETEKSI BADGE ---
    // Mencocokkan bagian dari URL gambar (src) dengan Nama Badge
    badgePatterns: [
      {
        id: "Mall",
        // Mencocokkan "badge_os.png" atau variannya
        regex: /badge_os\.png/i 
      },
      {
        id: "Power Shop",
        // Mencocokkan "Power Merchant Pro" (URL encoded atau tidak)
        regex: /Power%20Merchant%20Pro|Power_Merchant_Pro/i
      },
      {
        id: "Power Merchant",
        // Fallback untuk PM biasa (jika ada)
        regex: /Power%20Merchant(?!%20Pro)|Power_Merchant(?!_Pro)/i
      }
    ]
  };
}
console.log("Pattern Config Loaded:", window.SCRAPER_CONFIG);