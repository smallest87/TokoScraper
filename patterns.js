// patterns.js
if (typeof window.SCRAPER_CONFIG === 'undefined') {
  window.SCRAPER_CONFIG = {
    // Container kartu masih butuh selector CSS agar kita bisa membedakan antar produk.
    // Kita gunakan selector yang paling stabil (container grid item).
    cardContainer: '.css-5wh65g', 

    // Disini kita definisikan POLA DATA (Regex)
    patterns: {
      // Pola Harga: Diawali "Rp", diikuti angka atau titik.
      // Contoh: Rp10.000, Rp 5.000.000
      price: /^Rp\s?[\d\.]+/i,

      // Pola Rating: Angka desimal 1.0 sampai 5.0
      // Contoh: 4.9, 5.0
      rating: /^[1-5]\.\d$/,

      // Pola Terjual: Angka diikuti kata "terjual" atau "sold"
      // Contoh: 100+ terjual, 5rb+ terjual
      sold: /(\d+[rbjt\+]?)\s+(terjual|sold)/i,
      
      // Pola Diskon: Angka persen (opsional, untuk membedakan harga asli vs diskon)
      discount: /^\d{1,2}%$/
    }
  };
}
console.log("Pattern Config Loaded:", window.SCRAPER_CONFIG);