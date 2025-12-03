// ==========================================
// 1. SETUP & STATE MANAGEMENT
// ==========================================
let collectedData = []; 
let uniqueUrls = new Set(); 
let isAutoRunning = false; // Flag untuk kontrol loop otomasi

// Elemen DOM Dasar
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');
const pageTypeIndicator = document.getElementById('page-type-indicator');

// Elemen DOM Otomasi
const btnAutoStart = document.getElementById('btnAutoStart');
const btnAutoStop = document.getElementById('btnAutoStop');
const inputDelayMin = document.getElementById('delayMin');
const inputDelayMax = document.getElementById('delayMax');
const autoStatusLabel = document.getElementById('auto-status');

if(btnExport) btnExport.innerText = "Export JSON";

// ==========================================
// 2. LISTENERS GLOBAL
// ==========================================

// Listener Pesan (Data Detail Masuk)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pdp_scraped") {
    // Kirim ID Tab pengirim agar bisa kita tutup
    handlePDPData(message.url, message.data, sender.tab ? sender.tab.id : null);
  }
});

// Auto-Detect Page Logic
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
// 3. LOGIKA OTOMASI (AUTO SCRAPER)
// ==========================================

btnAutoStart.addEventListener('click', async () => {
  // 1. Kumpulkan semua tombol "Buka & Detail" yang belum selesai
  // Kita cari tombol yang belum punya class 'processed'
  const buttons = Array.from(document.querySelectorAll('.btn-open-scrape:not(.processed)'));

  if (buttons.length === 0) {
    autoStatusLabel.innerText = "Tidak ada item untuk diproses.";
    return;
  }

  // 2. Setup State
  isAutoRunning = true;
  updateAutoUI(true);
  autoStatusLabel.innerText = `Menyiapkan ${buttons.length} item...`;

  // 3. Acak Urutan (Shuffle)
  const shuffledButtons = shuffleArray(buttons);

  // 4. Eksekusi Loop
  let processedCount = 0;
  
  for (const btn of shuffledButtons) {
    if (!isAutoRunning) break; // Cek tombol stop

    // Scroll ke elemen agar user tahu mana yang sedang dikerjakan
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Klik tombolnya (ini akan memicu logika btnOpen.onclick di renderItem)
    // Kita tambahkan flag 'auto-click' agar logic tahu ini otomatis
    btn.click();
    
    processedCount++;
    autoStatusLabel.innerText = `Memproses ${processedCount} dari ${buttons.length} (Acak)...`;

    // 5. Hitung Delay Humanize
    const min = parseFloat(inputDelayMin.value) * 1000;
    const max = parseFloat(inputDelayMax.value) * 1000;
    const randomDelay = Math.floor(Math.random() * (max - min + 1) + min);

    // Tunggu sebelum lanjut ke item berikutnya
    await sleep(randomDelay);
  }

  isAutoRunning = false;
  updateAutoUI(false);
  autoStatusLabel.innerText = isAutoRunning ? "Berhenti." : "Selesai semua!";
});

btnAutoStop.addEventListener('click', () => {
  isAutoRunning = false;
  updateAutoUI(false);
  autoStatusLabel.innerText = "Berhenti paksa...";
});

// --- Helper Automation ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function updateAutoUI(running) {
  btnAutoStart.disabled = running;
  btnAutoStop.disabled = !running;
  btnScrape.disabled = running;
  btnExport.disabled = running;
}

// ==========================================
// 4. HANDLER SCRAPING (LISTING)
// ==========================================
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Bukan Tokopedia", "red");
    return;
  }

  updatePageIndicator(tab.url);
  updateStatus("Sedang memindai halaman...", "orange");

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    if (chrome.runtime.lastError) {
      updateStatus("Gagal inject. Refresh.", "red");
      return;
    }
    chrome.tabs.sendMessage(tab.id, { action: "scrape_visible" }, (response) => {
      if (chrome.runtime.lastError) return updateStatus("Koneksi putus.", "red");
      
      if (response && response.status === "success") {
        processNewData(response.data);
      } else {
        updateStatus("Gagal baca data.", "red");
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
    updateStatus(`+${newCount} produk.`, "green");
    btnExport.disabled = false;
  }
}

// --- Basic Helpers ---
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

function detectPageType(urlString) {
  try {
    const url = new URL(urlString);
    const path = url.pathname;
    if (path.startsWith('/search')) return { code: 'search', label: "🔍 Pencarian" };
    if (/\/[\w\-\.]+\/(product|etalase)/i.test(path)) return { code: 'shop_list', label: "🏪 Toko" };
    return { code: 'other', label: "📄 Tokopedia" };
  } catch (e) { return { code: 'unknown', label: "?" }; }
}

function updatePageIndicator(url) {
  if(!pageTypeIndicator) return;
  const type = detectPageType(url);
  pageTypeIndicator.innerText = type.label;
  
  if(type.code === 'search') pageTypeIndicator.style.backgroundColor = "#fff3e0";
  else if(type.code === 'shop_list') pageTypeIndicator.style.backgroundColor = "#e8f5e9";
  else pageTypeIndicator.style.backgroundColor = "#f5f5f5";
}

function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}

// ==========================================
// 6. RENDER UI & DETAIL LOGIC (UPDATED)
// ==========================================
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  
  const uniqueId = btoa(item.productUrl).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  div.setAttribute('data-url', item.productUrl); 

  let badgeColor = "#999"; let badgeText = "Regular";
  if (item.shopBadge === "Mall") { badgeColor = "#D6001C"; badgeText = "Mall"; }
  else if (item.shopBadge === "Power Shop") { badgeColor = "#00AA5B"; badgeText = "Power Pro"; }

  div.innerHTML = `
    <img src="${item.imageUrl}" alt="img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">
    <div style="flex: 1; overflow: hidden; padding-left: 10px; display: flex; flex-direction: column; justify-content: center;">
      <div style="font-weight:600; font-size: 11px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</div>
      <div style="color: #00AA5B; font-weight: bold; font-size: 12px; margin-top: 2px;">${item.price}</div>
      <div style="font-size: 10px; color: #fa591d; margin-top: 2px;">${item.rating} ⭐ | ${item.sold}</div>
      
      <div class="action-row" style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display:flex; align-items:center;">
           <span style="background:${badgeColor}; color:white; padding: 1px 4px; border-radius:3px; font-weight:bold; font-size:9px; margin-right:5px;">${badgeText}</span>
           <span style="font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">${item.cleanShopName}</span>
        </div>
        
        <button class="btn-open-scrape" style="border:1px solid #00AA5B; background:white; color:#00AA5B; border-radius:3px; cursor:pointer; font-size:9px; padding:2px 6px;">
           🔗 Buka & Detail
        </button>
      </div>
    </div>

    <div id="detail-${uniqueId}" class="detail-box">
      <div class="status-loading">⏳ Memuat...</div>
      <div class="content-detail" style="display:none;">
         <div class="detail-images"></div>
         <p style="margin:2px 0;"><b>Stok:</b> <span class="val-stock">-</span></p>
         <p style="margin:2px 0;"><b>Deskripsi:</b> <span class="val-desc">-</span></p>
      </div>
    </div>
  `;

  const btnOpen = div.querySelector('.btn-open-scrape');
  const detailBox = div.querySelector(`#detail-${uniqueId}`);

  btnOpen.onclick = () => {
    // Tandai tombol sebagai 'processed' agar tidak diklik ulang oleh bot
    btnOpen.classList.add('processed');
    btnOpen.innerText = "⏳ Loading...";
    btnOpen.disabled = true;

    detailBox.classList.add('visible');
    
    // Buka Tab (Active: false agar tidak mengganggu user jika auto, tapi true jika manual klik)
    // Kita gunakan active: false agar automation tidak 'jumping' focus terus menerus
    const isActive = !isAutoRunning; 

    chrome.tabs.create({ url: item.productUrl, active: isActive }, (newTab) => {
      
      const listener = (tabId, changeInfo, tab) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['pdp_patterns.js', 'pdp_scraper.js']
          });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  };

  resultsContainer.appendChild(div); 
}

// --- Handler Data Detail + AUTO CLOSE ---
function handlePDPData(url, data, senderTabId) {
  const cleanUrl = url.split('?')[0];
  const itemDiv = document.querySelector(`div[data-url^="${cleanUrl}"]`);
  
  // Jika tab pengirim ada, TUTUP TAB-nya (Fitur Auto-Close)
  if (senderTabId) {
    chrome.tabs.remove(senderTabId);
  }

  if (!itemDiv) return;

  const uniqueId = btoa(itemDiv.getAttribute('data-url')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const detailBox = document.getElementById(`detail-${uniqueId}`);
  const btnOpen = itemDiv.querySelector('.btn-open-scrape');

  // Update Tombol jadi 'Done'
  if (btnOpen) {
    btnOpen.innerText = "✔ Selesai";
    btnOpen.style.borderColor = "#ccc";
    btnOpen.style.color = "#ccc";
  }

  if (!detailBox) return;

  const loading = detailBox.querySelector('.status-loading');
  const content = detailBox.querySelector('.content-detail');
  const imgContainer = detailBox.querySelector('.detail-images');
  
  loading.style.display = 'none';
  content.style.display = 'block';
  
  detailBox.querySelector('.val-desc').innerText = data.description || "-";
  detailBox.querySelector('.val-stock').innerText = data.stock || "-";

  imgContainer.innerHTML = '';
  if (data.images && data.images.length > 0) {
    data.images.slice(0, 5).forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      imgContainer.appendChild(img);
    });
  }

  if (data.shopLocation) {
    const locInfo = document.createElement('div');
    locInfo.style.cssText = "font-size: 9px; color: #555; margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 4px;";
    locInfo.innerHTML = `<b>Pengiriman:</b> ${data.shopLocation}`;
    content.appendChild(locInfo);
  }

  const dataIndex = collectedData.findIndex(d => d.productUrl === itemDiv.getAttribute('data-url'));
  if (dataIndex !== -1) {
    collectedData[dataIndex].details = data;
  }
}

// ==========================================
// 7. EXPORT NESTED JSON
// ==========================================
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) return updateStatus("Kosong", "red");
  
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

    const productEntry = {
      name: item.name,
      price: typeof DataFormatter !== 'undefined' ? DataFormatter.price(item.price) : item.price,
      rating: typeof DataFormatter !== 'undefined' ? DataFormatter.rating(item.rating) : item.rating,
      sold: typeof DataFormatter !== 'undefined' ? DataFormatter.sold(item.sold) : item.sold,
      imageUrl: item.imageUrl,
      link: item.productUrl,
      detail: null
    };

    if (item.details) {
      productEntry.detail = {
        fullName: item.details.fullName,
        description: item.details.description,
        stock: item.details.stock,
        images: item.details.images,
        shopLocationFromDetail: item.details.shopLocation
      };
    }

    shopsMap.get(shopKey).products.push(productEntry);
  });

  const finalJsonData = Array.from(shopsMap.values());
  const jsonString = JSON.stringify(finalJsonData, null, 2); 
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.setAttribute("href", url);
  link.setAttribute("download", `tokopedia_data_${timestamp}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});