// ==========================================
// 1. SETUP & STATE MANAGEMENT
// ==========================================
let collectedData = []; 
let uniqueUrls = new Set(); 
let isAutoRunning = false;

// Referensi Elemen DOM Utama
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');
const pageTypeIndicator = document.getElementById('page-type-indicator');

// Referensi Elemen Search & Filter
const searchInput = document.getElementById('searchInput');
const toggleNot = document.getElementById('toggleNot');
const filteredCountLabel = document.getElementById('filtered-count');

// Referensi Elemen Otomasi
const btnAutoStart = document.getElementById('btnAutoStart');
const btnAutoStop = document.getElementById('btnAutoStop');
const inputDelayMin = document.getElementById('delayMin');
const inputDelayMax = document.getElementById('delayMax');
const autoStatusLabel = document.getElementById('auto-status');

// Inisialisasi Teks Tombol Export
if(btnExport) btnExport.innerText = "Export JSON";

// ==========================================
// 2. GLOBAL LISTENERS (Tabs & Messages)
// ==========================================

// Listener pesan dari Content Scripts (PDP Scraper & Highlight response)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pdp_scraped") {
    // Handle data detail dan tutup tab pengirim (Auto-Close)
    handlePDPData(message.url, message.data, sender.tab ? sender.tab.id : null);
  }
});

// Auto-Detect Halaman saat panel dibuka/refresh/ganti tab
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
// 3. FITUR SEARCH & FILTER REALTIME
// ==========================================
searchInput.addEventListener('input', runFilter);
toggleNot.addEventListener('change', runFilter);

function runFilter() {
  const query = searchInput.value.toLowerCase().trim();
  const isNotMode = toggleNot.checked;
  
  const itemElements = document.querySelectorAll('.item-preview');
  let visibleCount = 0;

  itemElements.forEach(el => {
    // Cari teks di dalam elemen item
    const textContent = el.innerText.toLowerCase();
    const isMatch = textContent.includes(query);
    
    let shouldShow = true;
    if (query === "") {
      shouldShow = true;
    } else {
      shouldShow = isNotMode ? !isMatch : isMatch;
    }

    el.style.display = shouldShow ? 'flex' : 'none';
    if (shouldShow) visibleCount++;
  });

  // Update UI Counter Filter
  if (filteredCountLabel) {
    if (query !== "") {
      filteredCountLabel.style.display = 'inline';
      filteredCountLabel.innerText = `(Filtered: ${visibleCount})`;
    } else {
      filteredCountLabel.style.display = 'none';
    }
  }
}

// ==========================================
// 4. FITUR OTOMASI (AUTO CLICKER)
// ==========================================
btnAutoStart.addEventListener('click', async () => {
  // Hanya ambil tombol yang visible (lolos filter) dan belum diproses
  // Kita cari container item dulu untuk cek visibility
  const allItems = Array.from(document.querySelectorAll('.item-preview'));
  
  const buttonsToClick = [];
  
  allItems.forEach(item => {
    if (item.style.display !== 'none') { // Hanya yang terlihat
      const btn = item.querySelector('.btn-open-scrape:not(.processed)');
      if (btn) buttonsToClick.push(btn);
    }
  });

  if (buttonsToClick.length === 0) {
    autoStatusLabel.innerText = "Tidak ada item untuk diproses.";
    return;
  }

  isAutoRunning = true;
  updateAutoUI(true);
  autoStatusLabel.innerText = `Menyiapkan ${buttonsToClick.length} item...`;

  // Shuffle urutan agar lebih humanis
  const shuffledButtons = shuffleArray(buttonsToClick);
  let processedCount = 0;
  
  for (const btn of shuffledButtons) {
    if (!isAutoRunning) break; 

    // Cek keberadaan elemen di DOM (jaga-jaga dihapus user saat proses)
    if (document.body.contains(btn)) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.click();
      
      processedCount++;
      autoStatusLabel.innerText = `Memproses ${processedCount} dari ${buttonsToClick.length}...`;

      const min = parseFloat(inputDelayMin.value) * 1000;
      const max = parseFloat(inputDelayMax.value) * 1000;
      const randomDelay = Math.floor(Math.random() * (max - min + 1) + min);

      await sleep(randomDelay);
    }
  }

  isAutoRunning = false;
  updateAutoUI(false);
  autoStatusLabel.innerText = isAutoRunning ? "Berhenti." : "Selesai antrean.";
});

btnAutoStop.addEventListener('click', () => {
  isAutoRunning = false;
  updateAutoUI(false);
  autoStatusLabel.innerText = "Berhenti paksa...";
});

// ==========================================
// 5. HANDLER SCRAPING UTAMA (LISTING)
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
    if (chrome.runtime.lastError) return updateStatus("Gagal inject.", "red");
    
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
// 6. PROCESSING DATA
// ==========================================
function processNewData(items) {
  let newCount = 0;
  items.forEach(item => {
    if (item.productUrl && !uniqueUrls.has(item.productUrl)) {
      // Data enrichment
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
    
    // Jalankan filter jika sedang ada query pencarian aktif
    if (searchInput.value.trim() !== "") runFilter();
  }
}

// ==========================================
// 7. RENDER ITEM (UI, LOGIC, HIGHLIGHT)
// ==========================================
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  div.style.cursor = 'pointer'; // Indikator bisa diklik
  
  // ID Unik untuk Container Detail
  const uniqueId = btoa(item.productUrl).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  div.setAttribute('data-url', item.productUrl); 

  // Badge Logic
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
           <span style="font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">${item.cleanShopName}</span>
        </div>
        
        <div style="display:flex; gap:3px;">
          <button class="btn-delete" title="Hapus Item" style="border:1px solid #ffcdd2; background:#ffebee; color:#c62828; border-radius:3px; cursor:pointer; font-size:9px; padding:2px 5px;">🗑️</button>
          <button class="btn-open-scrape" style="border:1px solid #00AA5B; background:white; color:#00AA5B; border-radius:3px; cursor:pointer; font-size:9px; padding:2px 6px;">🔗 Buka</button>
        </div>
      </div>
      
      <div style="font-size: 9px; color: #888; margin-top: 2px;">
         📍 ${item.cleanLocation} (${item.shopUsername})
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

  // --- A. LOGIKA HIGHLIGHT (CLICK LISTENER) ---
  div.addEventListener('click', async (e) => {
    // Cegah highlight jika yang diklik adalah tombol atau area detail
    if (e.target.closest('button') || e.target.closest('.detail-box')) {
      return; 
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: "highlight_item", 
        url: item.productUrl 
      }).catch(err => console.log("Gagal highlight:", err));
    }
  });

  // --- B. LOGIKA HAPUS ---
  const btnDelete = div.querySelector('.btn-delete');
  btnDelete.onclick = (e) => {
    e.stopPropagation(); // Stop event agar tidak trigger highlight
    div.remove();
    collectedData = collectedData.filter(d => d.productUrl !== item.productUrl);
    uniqueUrls.delete(item.productUrl);
    countLabel.innerText = collectedData.length;
    
    // Update counter filter jika sedang aktif
    if (searchInput.value.trim() !== "") runFilter();

    if (collectedData.length === 0) {
      btnExport.disabled = true;
      updateStatus("List kosong.", "#666");
    }
  };

  // --- C. LOGIKA BUKA & SCRAPE ---
  const btnOpen = div.querySelector('.btn-open-scrape');
  const detailBox = div.querySelector(`#detail-${uniqueId}`);

  btnOpen.onclick = (e) => {
    e.stopPropagation(); // Stop event highlight
    
    btnOpen.classList.add('processed');
    btnOpen.innerText = "⏳...";
    btnOpen.disabled = true;
    detailBox.classList.add('visible');
    
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

  // APPEND CHILD (Urutan sesuai halaman)
  resultsContainer.appendChild(div); 
}

// --- Handler Data Detail + AUTO CLOSE ---
function handlePDPData(url, data, senderTabId) {
  const cleanUrl = url.split('?')[0];
  const itemDiv = document.querySelector(`div[data-url^="${cleanUrl}"]`);
  
  if (senderTabId) chrome.tabs.remove(senderTabId); // Close Tab

  if (!itemDiv) return;

  const uniqueId = btoa(itemDiv.getAttribute('data-url')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const detailBox = document.getElementById(`detail-${uniqueId}`);
  const btnOpen = itemDiv.querySelector('.btn-open-scrape');

  if (btnOpen) {
    btnOpen.innerText = "✔";
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

  // Update Data Memory
  const dataIndex = collectedData.findIndex(d => d.productUrl === itemDiv.getAttribute('data-url'));
  if (dataIndex !== -1) {
    collectedData[dataIndex].details = data;
  }
}

// ==========================================
// 8. EXPORT NESTED JSON
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

// --- Helpers Utilities ---
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
  
  if (!url.includes('tokopedia.com')) {
    setIndicator("❌ Bukan Halaman Tokopedia", "#ffebee", "#c62828", "#ffcdd2");
    if(btnScrape) btnScrape.disabled = true;
    return;
  }
  
  if(btnScrape) btnScrape.disabled = false;
  const type = detectPageType(url);
  setIndicator(type.label, 
    type.code === 'search' ? "#fff3e0" : (type.code === 'shop_list' ? "#e8f5e9" : "#f5f5f5"),
    type.code === 'search' ? "#e65100" : (type.code === 'shop_list' ? "#1b5e20" : "#616161"),
    type.code === 'search' ? "#ffe0b2" : (type.code === 'shop_list' ? "#c8e6c9" : "#e0e0e0")
  );
}

function setIndicator(text, bg, color, border) {
  pageTypeIndicator.innerText = text;
  pageTypeIndicator.style.backgroundColor = bg;
  pageTypeIndicator.style.color = color;
  pageTypeIndicator.style.borderColor = border;
}

function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

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