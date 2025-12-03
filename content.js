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
  const cards = document.querySelectorAll(CONFIG.cardContainer);

  cards.forEach((card) => {
    try {
      let itemData = {
        name: "", price: "", rating: "", sold: "", shopLocation: "", 
        imageUrl: "", productUrl: "", 
        shopBadge: "Regular" // Default jika tidak ada badge
      };

      // 1. AMBIL LINK
      const anchor = card.querySelector('a');
      if (!anchor || !anchor.href) return;
      itemData.productUrl = anchor.href;

      // 2. AMBIL SEMUA GAMBAR (Produk & Badge)
      const allImages = Array.from(card.querySelectorAll('img'));
      
      // Gambar produk biasanya adalah gambar pertama atau yang terbesar
      // Kita asumsikan gambar pertama adalah gambar produk
      if (allImages.length > 0) {
        itemData.imageUrl = allImages[0].src;
      }

      // --- LOGIKA DETEKSI BADGE ---
      // Loop semua gambar di card untuk mencari yang cocok dengan pola badge
      for (const img of allImages) {
        const src = img.src;
        let foundBadge = false;

        for (const badgePattern of CONFIG.badgePatterns) {
          if (badgePattern.regex.test(src)) {
            itemData.shopBadge = badgePattern.id;
            foundBadge = true;
            break; 
          }
        }
        if (foundBadge) break; // Jika sudah ketemu, stop cari badge lain
      }
      // ----------------------------

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

        if (text.length > 20) {
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