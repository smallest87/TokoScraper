// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape_visible") {
    if (!window.SCRAPER_CONFIG) {
      console.error("Config pola belum dimuat!");
      sendResponse({ status: "error", message: "Config missing" });
      return;
    }
    const data = scrapeWithHeuristics();
    sendResponse({ status: "success", data: data });
  }
  return true;
});

function scrapeWithHeuristics() {
  const CONFIG = window.SCRAPER_CONFIG;
  const products = [];
  
  // 1. Ambil semua kartu produk
  const cards = document.querySelectorAll(CONFIG.cardContainer);

  cards.forEach((card) => {
    try {
      // Object penampung data sementara
      let itemData = {
        name: "",
        price: "",
        rating: "",
        sold: "",
        shopLocation: "", // Kita gabung dulu biar aman
        imageUrl: "",
        productUrl: ""
      };

      // A. Ambil Link & Gambar (Ini tetap butuh selector tag HTML dasar)
      const anchor = card.querySelector('a');
      const img = card.querySelector('img');
      
      if (!anchor) return; // Skip jika bukan kartu link
      itemData.productUrl = anchor.href;
      itemData.imageUrl = img ? img.src : "";

      // B. AMBIL SEMUA TEKS DALAM KARTU
      // innerText akan mengambil teks yang terlihat user, dipisah baris baru (\n)
      const rawText = card.innerText; 
      const textLines = rawText.split('\n').map(t => t.trim()).filter(t => t.length > 0);

      // C. ITERASI & DETEKSI (HEURISTIC)
      const potentialTitles = [];
      const potentialShops = [];

      textLines.forEach(text => {
        // Cek 1: Apakah ini Harga?
        if (CONFIG.patterns.price.test(text)) {
          // Tokopedia kadang menampilkan 2 harga (coret & asli).
          // Harga asli biasanya adalah string harga yang paling akhir atau tidak diikuti diskon.
          // Untuk simpelnya, kita ambil yang terakhir ditemukan (biasanya harga fix) 
          // atau simpan semua dan filter nanti.
          itemData.price = text; 
          return;
        }

        // Cek 2: Apakah ini Rating?
        if (CONFIG.patterns.rating.test(text)) {
          itemData.rating = text;
          return;
        }

        // Cek 3: Apakah ini data Terjual?
        if (CONFIG.patterns.sold.test(text)) {
          itemData.sold = text;
          return;
        }

        // Cek 4: Apakah ini label diskon? (Buang saja)
        if (CONFIG.patterns.discount.test(text)) return;

        // Cek 5: Sisa Teks (Kemungkinan Judul atau Nama Toko/Lokasi)
        // Logika: Judul biasanya panjang (> 20 karakter) atau berada di urutan awal.
        // Nama Toko/Lokasi biasanya pendek dan ada di urutan akhir.
        if (text.length > 20) {
          potentialTitles.push(text);
        } else {
          // Filter teks sampah kecil (seperti 'Ad', 'Grosir', dll)
          if (text.length > 3) potentialShops.push(text);
        }
      });

      // D. KESIMPULAN AKHIR
      
      // Judul biasanya adalah text panjang pertama
      itemData.name = potentialTitles.length > 0 ? potentialTitles[0] : (textLines[0] || "No Name");
      
      // Lokasi/Toko biasanya sisa teks yang pendek
      // Kita gabungkan saja sisa teks pendek yang ditemukan
      itemData.shopLocation = potentialShops.join(" - ");

      products.push(itemData);

    } catch (e) {
      console.error("Error heuristic:", e);
    }
  });

  return products;
}