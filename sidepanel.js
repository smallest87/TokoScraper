// ==========================================
// 1. SETUP & VARIABEL GLOBAL
// ==========================================
let collectedData = []; 
let uniqueUrls = new Set(); 

// Referensi Elemen DOM
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');
const pageTypeIndicator = document.getElementById('page-type-indicator');

// Ubah teks tombol agar sesuai
btnExport.innerText = "Export JSON";

// ==========================================
// 2. AUTO-DETECT LISTENERS
// ==========================================
(async function initPageCheck() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) updatePageIndicator(tab.url);
  } catch (e) { console.log(e); }
})();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) updatePageIndicator(tabs[0].url);
    });
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab && tab.url) updatePageIndicator(tab.url);
});

// ==========================================
// 3. LOGIKA DETEKSI HALAMAN
// ==========================================
function updatePageIndicator(url) {
  if (!url.includes('tokopedia.com')) {
    setIndicator("❌ Bukan Halaman Tokopedia", "#ffebee", "#c62828", "#ffcdd2");
    btnScrape.disabled = true;
    return;
  }

  btnScrape.disabled = false;
  const type = detectPageType(url);
  
  switch (type.code) {
    case 'search': setIndicator(type.label, "#fff3e0", "#e65100", "#ffe0b2"); break;
    case 'shop_home':
    case 'shop_list':
    case 'shop_review': setIndicator(type.label, "#e8f5e9", "#1b5e20", "#c8e6c9"); break;
    case 'pdp': setIndicator(type.label, "#e3f2fd", "#0d47a1", "#bbdefb"); break;
    default: setIndicator(type.label, "#f5f5f5", "#616161", "#e0e0e0");
  }
}

function setIndicator(text, bg, color, border) {
  pageTypeIndicator.innerText = text;
  pageTypeIndicator.className = 'page-info';
  pageTypeIndicator.style.backgroundColor = bg;
  pageTypeIndicator.style.color = color;
  pageTypeIndicator.style.borderColor = border;
}

function detectPageType(urlString) {
  try {
    const url = new URL(urlString);
    const path = url.pathname;
    const segments = path.split('/').filter(s => s.length > 0);

    if (path.startsWith('/search')) return { code: 'search', label: "🔍 Halaman Hasil Pencarian" };

    if (segments.length >= 1) {
      const reservedRoot = ['about', 'promo', 'help', 'cart', 'user', 'login', 'discovery', 'category'];
      if (reservedRoot.includes(segments[0])) return { code: 'other', label: "📄 Halaman Tokopedia Umum" };

      if (segments.length === 1) return { code: 'shop_home', label: "🏠 Halaman Beranda Toko" };

      if (segments.length >= 2) {
        const secondSegment = segments[1].toLowerCase();
        if (secondSegment === 'review') return { code: 'shop_review', label: "⭐ Halaman Review Toko" };
        if (secondSegment === 'product' || secondSegment === 'etalase') return { code: 'shop_list', label: "🏪 Halaman Produk Toko" };
        
        const reservedSecond = ['review', 'product', 'etalase', 'info', 'catatan', 'delivery'];
        if (!reservedSecond.includes(secondSegment)) return { code: 'pdp', label: "📦 Halaman Detail Produk" };
      }
    }
    return { code: 'other', label: "📄 Halaman Tokopedia Umum" };
  } catch (e) {
    return { code: 'unknown', label: "❓ URL Tidak Valid" };
  }
}

// ==========================================
// 4. HANDLER SCRAPING
// ==========================================
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Bukan Tokopedia", "red");
    return;
  }

  updatePageIndicator(tab.url);
  updateStatus("Sedang memindai...", "orange");

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    if (chrome.runtime.lastError) {
      updateStatus("Gagal inject script. Refresh halaman.", "red");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "scrape_visible" }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus("Koneksi terputus. Refresh halaman.", "red");
        return;
      }
      if (response && response.status === "success") {
        processNewData(response.data);
      } else {
        updateStatus("Gagal membaca data.", "red");
      }
    });
  });
});

// ==========================================
// 5. PROCESSING DATA
// ==========================================
function processNewData(items) {
  let newCount = 0;
  items.forEach(item => {
    if (item.productUrl && !uniqueUrls.has(item.productUrl)) {
      item.shopUsername = extractUsername(item.productUrl);
      const parsedShop = parseShopData(item.shopLocation);
      item.cleanShopName = parsedShop.name;
      item.cleanLocation = parsedShop.location;

      uniqueUrls.add(item.productUrl);
      collectedData.push(item);
      renderItem(item);
      newCount++;
    }
  });

  countLabel.innerText = collectedData.length;
  if (newCount > 0) {
    updateStatus(`+${newCount} produk baru. Scroll lagi!`, "green");
    btnExport.disabled = false;
  } else {
    updateStatus("Tidak ada produk baru.", "#666");
  }
}

function parseShopData(combinedString) {
  if (!combinedString) return { name: "-", location: "-" };
  const parts = combinedString.split(" - ");
  if (parts.length === 1) return { name: parts[0], location: "-" };
  const location = parts.pop(); 
  const name = parts.join(" - "); 
  return { name, location };
}

function extractUsername(urlString) {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/');
    if (segments.length > 1 && segments[1]) return segments[1];
    return "-";
  } catch (e) { return "-"; }
}

function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}

// ==========================================
// 6. RENDER UI
// ==========================================
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  
  let badgeColor = "#999"; let badgeText = "Regular";
  if (item.shopBadge === "Mall") { badgeColor = "#D6001C"; badgeText = "Mall"; }
  else if (item.shopBadge === "Power Shop") { badgeColor = "#00AA5B"; badgeText = "Power Pro"; }

  div.innerHTML = `
    <img src="${item.imageUrl}" alt="img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">
    <div style="flex: 1; overflow: hidden; padding-left: 10px; display: flex; flex-direction: column; justify-content: center;">
      <div style="font-weight:600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333;" title="${item.name}">
        ${item.name}
      </div>
      <div style="color: #00AA5B; font-weight: bold; font-size: 12px; margin-top: 2px;">
        ${item.price}
      </div>
      <div style="font-size: 10px; color: #fa591d; margin-top: 2px;">
        ${item.rating ? `⭐ ${item.rating}` : ''} ${item.sold ? ` | ${item.sold}` : ''}
      </div>
      <div class="action-row" style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display:flex; align-items:center;">
           <span style="background:${badgeColor}; color:white; padding: 1px 4px; border-radius:3px; font-weight:bold; font-size:9px; margin-right:5px;">${badgeText}</span>
           <span style="font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">${item.cleanShopName}</span>
        </div>
      </div>
      <div style="font-size: 9px; color: #888; margin-top: 2px;">
         📍 ${item.cleanLocation}
      </div>
    </div>
  `;

  // Append Link Button Logic
  const actionRow = div.querySelector('.action-row');
  const btnLink = document.createElement('button');
  btnLink.innerText = "🔗 Buka";
  btnLink.style.cssText = "border: 1px solid #ccc; background: #fff; border-radius: 3px; cursor: pointer; font-size: 9px; padding: 1px 5px; margin-left: 5px;";
  if (typeof LinkHelper !== 'undefined') LinkHelper.attach(btnLink, item.productUrl);
  else btnLink.onclick = () => window.open(item.productUrl, '_blank');
  actionRow.appendChild(btnLink);

  resultsContainer.appendChild(div); 
}

// ==========================================
// 7. EXPORT JSON (DENGAN FORMATTERS)
// ==========================================
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) {
    updateStatus("Belum ada data untuk diekspor!", "red");
    return;
  }
  
  // A. TRANSFORMA DATA
  const shopsMap = new Map();

  collectedData.forEach(item => {
    const shopKey = item.shopUsername || "unknown_shop";

    if (!shopsMap.has(shopKey)) {
      shopsMap.set(shopKey, {
        shopInfo: {
          username: item.shopUsername,
          name: item.cleanShopName,
          location: item.cleanLocation,
          badge: item.shopBadge,
          rawLocationString: item.shopLocation 
        },
        products: [] 
      });
    }

    // --- PENERAPAN FORMATTER DI SINI ---
    // Kita bersihkan data mentah menjadi tipe data yang benar
    shopsMap.get(shopKey).products.push({
      name: item.name,
      
      // Price: String "Rp..." -> Integer
      price: DataFormatter.price(item.price), 
      
      // Rating: String "4.9" -> Float 4.9
      rating: DataFormatter.rating(item.rating), 
      
      // Sold: String "100+ terjual" -> Integer 101
      sold: DataFormatter.sold(item.sold), 
      
      // Simpan juga string aslinya jika butuh referensi (opsional)
      originalPrice: item.price, 
      originalSold: item.sold,

      imageUrl: item.imageUrl,
      link: item.productUrl
    });
    // -----------------------------------
  });

  const finalJsonData = Array.from(shopsMap.values());

  // B. BUAT FILE DOWNLOAD
  const jsonString = JSON.stringify(finalJsonData, null, 2); 
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.setAttribute("href", url);
  link.setAttribute("download", `tokopedia_data_${timestamp}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});