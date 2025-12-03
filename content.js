chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape_visible") {
    if (!window.SCRAPER_CONFIG) {
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
  
  // --- LOGIKA PEMILIHAN SELECTOR ---
  let activeSelector = CONFIG.containers.search; // Default
  const currentPath = window.location.pathname;

  // Cek apakah ini halaman pencarian atau halaman toko
  if (currentPath.startsWith('/search')) {
    console.log("Mode: Search Page Scraping");
    activeSelector = CONFIG.containers.search;
  } else {
    console.log("Mode: Shop Page Scraping");
    activeSelector = CONFIG.containers.shop;
  }
  // ---------------------------------

  const cards = document.querySelectorAll(activeSelector);
  
  // Debugging: Cek jika selector salah/tidak ada item
  if (cards.length === 0) {
    console.warn(`Tidak ada item ditemukan dengan selector: ${activeSelector}`);
  }

  cards.forEach((card) => {
    try {
      let itemData = {
        name: "", price: "", rating: "", sold: "", shopLocation: "", 
        imageUrl: "", productUrl: "", shopBadge: "Regular"
      };

      // 1. AMBIL LINK
      const anchor = card.querySelector('a');
      if (!anchor || !anchor.href) return;
      itemData.productUrl = anchor.href;

      // 2. AMBIL GAMBAR
      const allImages = Array.from(card.querySelectorAll('img'));
      if (allImages.length > 0) {
        // Logika prioritas gambar: 
        // Di halaman toko, kadang gambar produk bukan yg pertama. 
        // Tapi untuk simplifikasi kita ambil index 0 dulu.
        itemData.imageUrl = allImages[0].src;
      }

      // Deteksi Badge
      for (const img of allImages) {
        for (const badgePattern of CONFIG.badgePatterns) {
          if (badgePattern.regex.test(img.src)) {
            itemData.shopBadge = badgePattern.id;
            break; 
          }
        }
      }

      // 3. HEURISTIC TEXT
      const rawText = card.innerText; 
      const textLines = rawText.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      const potentialTitles = [];
      const potentialShops = [];

      textLines.forEach(text => {
        if (CONFIG.patterns.price.test(text)) { itemData.price = text; return; }
        if (CONFIG.patterns.rating.test(text)) { itemData.rating = text; return; }
        if (CONFIG.patterns.sold.test(text)) { itemData.sold = text; return; }
        if (CONFIG.patterns.discount.test(text)) return;

        // Filter Judul vs Info Lain
        if (text.length > 15) { // Sedikit diturunkan threshold-nya
          potentialTitles.push(text);
        } else {
          if (text.length > 3) potentialShops.push(text);
        }
      });

      itemData.name = potentialTitles.length > 0 ? potentialTitles[0] : (textLines[0] || "No Name");
      itemData.shopLocation = potentialShops.join(" - ");

      products.push(itemData);

    } catch (e) {
      console.error("Error heuristic:", e);
    }
  });

  return products;
}

// ... (Kode sebelumnya tetap ada) ...

// ==========================================
// FITUR BARU: HIGHLIGHT ITEM DARI SIDEPANEL
// ==========================================
let lastHighlightedElement = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handler pesan "highlight_item"
  if (request.action === "highlight_item") {
    highlightProductOnPage(request.url);
    sendResponse({ status: "highlighted" });
  }
  // Jangan lupa return true untuk async response (jika diperlukan)
  return true;
});

function highlightProductOnPage(targetUrl) {
  // 1. Bersihkan highlight sebelumnya (jika ada)
  if (lastHighlightedElement) {
    lastHighlightedElement.style.outline = "";
    lastHighlightedElement.style.backgroundColor = "";
    lastHighlightedElement.style.transition = "";
  }

  // 2. Cari elemen berdasarkan URL link (href)
  // Kita cari tag <a> yang href-nya persis dengan targetUrl
  // Gunakan CSS escaping untuk karakter spesial di URL jika perlu, 
  // tapi biasanya selector attribute value aman dengan kutip ganda.
  const selector = `a[href="${targetUrl}"]`;
  const anchor = document.querySelector(selector);

  if (anchor) {
    // Cari container kartu pembungkusnya (naik ke atas DOM)
    // Gunakan konfigurasi container yang sudah ada di patterns.js atau fallback
    const CONFIG = window.SCRAPER_CONFIG;
    let card = null;
    
    if (CONFIG && CONFIG.cardContainer) {
       // Coba cari parent yang cocok dengan selector container
       // Note: closest() butuh selector spesifik. 
       // Jika CONFIG.containers adalah object (search/shop), kita cek satu2
       if (typeof CONFIG.containers === 'object') {
          card = anchor.closest(CONFIG.containers.search) || anchor.closest(CONFIG.containers.shop);
       } else {
          card = anchor.closest(CONFIG.cardContainer);
       }
    }

    // Fallback: Jika tidak ketemu container, highlight anchor-nya saja atau parent div terdekat
    if (!card) {
      card = anchor.closest('div'); 
    }

    if (card) {
      // 3. Aksi Highlight
      
      // Scroll ke elemen (tengah layar)
      card.scrollIntoView({ behavior: "smooth", block: "center" });

      // Beri efek visual (Border Merah Tebal & Flash Background)
      card.style.transition = "all 0.3s ease";
      card.style.outline = "4px solid #f94d63"; // Warna merah mencolok
      card.style.backgroundColor = "rgba(249, 77, 99, 0.1)"; // Background merah tipis
      
      lastHighlightedElement = card;
    } else {
      console.warn("Kartu produk tidak ditemukan di DOM.");
    }
  } else {
    console.warn("Link produk tidak ditemukan di halaman ini:", targetUrl);
  }
}