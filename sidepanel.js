// Alias Dependencies
const State = window.AppState;
const Utils = window.AppUtils;
const UI = State.UI;

if(UI.btnExport) UI.btnExport.innerText = "Export JSON";

// ==========================================
// 1. LISTENERS GLOBAL
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pdp_scraped") {
    handlePDPData(message.url, message.data, sender.tab ? sender.tab.id : null);
  }
});

(async function initPageCheck() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) Utils.updatePageIndicator(tab.url);
  } catch (e) { console.log(e); }
})();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) Utils.updatePageIndicator(tabs[0].url);
    });
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab && tab.url) Utils.updatePageIndicator(tab.url);
});

// ==========================================
// 2. SEARCH, FILTER, SORT & BULK DELETE
// ==========================================
UI.searchInput.addEventListener('input', runFilter);
UI.toggleNot.addEventListener('change', runFilter);
UI.sortBySelect.addEventListener('change', runSort);
UI.sortOrderSelect.addEventListener('change', runSort);

// --- FITUR BARU: BULK DELETE ---
UI.btnBulkDelete.addEventListener('click', () => {
  // 1. Cari item yang visible
  const allPreviews = document.querySelectorAll('.item-preview');
  const visibleItems = [];

  allPreviews.forEach(el => {
    if (el.style.display !== 'none') visibleItems.push(el);
  });

  if (visibleItems.length === 0) {
    alert("Tidak ada item yang tampil untuk dihapus.");
    return;
  }

  const confirmMsg = `Hapus ${visibleItems.length} item yang tampil?\n(Item tersembunyi/tidak cocok filter aman)`;
  if (!confirm(confirmMsg)) return;

  // 2. Hapus Item
  const urlsToRemove = new Set();
  visibleItems.forEach(el => {
    const url = el.getAttribute('data-url');
    if (url) urlsToRemove.add(url);
    el.remove();
  });

  // 3. Update Memory
  State.collectedData = State.collectedData.filter(item => !urlsToRemove.has(item.productUrl));
  State.uniqueUrls = new Set(State.collectedData.map(item => item.productUrl));

  // 4. Update UI
  UI.countLabel.innerText = State.collectedData.length;
  if (UI.filteredCountLabel) UI.filteredCountLabel.style.display = 'none';

  if (State.collectedData.length === 0) {
    UI.btnExport.disabled = true;
    Utils.updateStatus("List kosong.", "#666");
  } else {
    Utils.updateStatus(`Berhasil menghapus ${visibleItems.length} item.`, "green");
  }
  
  runFilter(); // Refresh status filter
});

// --- FILTER LOGIC ---
function runFilter() {
  const query = UI.searchInput.value.toLowerCase().trim();
  const isNotMode = UI.toggleNot.checked;
  const itemElements = document.querySelectorAll('.item-preview');
  let visibleCount = 0;

  itemElements.forEach(el => {
    const textContent = el.innerText.toLowerCase();
    const isMatch = textContent.includes(query);
    const shouldShow = query === "" ? true : (isNotMode ? !isMatch : isMatch);

    el.style.display = shouldShow ? 'flex' : 'none';
    if (shouldShow) visibleCount++;
  });

  if (UI.filteredCountLabel) {
    UI.filteredCountLabel.style.display = query !== "" ? 'inline' : 'none';
    UI.filteredCountLabel.innerText = `(Filtered: ${visibleCount})`;
  }
}

// --- SORT LOGIC ---
function runSort() {
  const criteria = UI.sortBySelect.value;
  const order = UI.sortOrderSelect.value;

  State.collectedData.sort((a, b) => {
    let valA, valB;
    if (criteria === 'newest') return order === 'asc' ? 1 : -1;
    else {
      valA = a[criteria]; valB = b[criteria];
    }
    return order === 'asc' ? valA - valB : valB - valA;
  });

  if (criteria === 'newest' && order === 'desc') State.collectedData.reverse();

  UI.resultsContainer.innerHTML = ''; 
  State.collectedData.forEach(item => renderItem(item)); 
  runFilter(); 
}

// ==========================================
// 3. OTOMASI
// ==========================================
UI.btnAutoStart.addEventListener('click', async () => {
  const allItems = Array.from(document.querySelectorAll('.item-preview'));
  const buttonsToClick = [];
  
  allItems.forEach(item => {
    if (item.style.display !== 'none') {
      const btn = item.querySelector('.btn-open-scrape:not(.processed)');
      if (btn) buttonsToClick.push(btn);
    }
  });

  if (buttonsToClick.length === 0) {
    UI.autoStatusLabel.innerText = "Tidak ada item untuk diproses.";
    return;
  }

  State.isAutoRunning = true;
  Utils.updateAutoUI(true);
  UI.autoStatusLabel.innerText = `Menyiapkan ${buttonsToClick.length} item...`;

  const shuffledButtons = Utils.shuffleArray(buttonsToClick);
  let processedCount = 0;
  
  for (const btn of shuffledButtons) {
    if (!State.isAutoRunning) break; 
    
    if (document.body.contains(btn)) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.click();
      processedCount++;
      UI.autoStatusLabel.innerText = `Memproses ${processedCount} dari ${buttonsToClick.length}...`;
      
      const min = parseFloat(UI.inputDelayMin.value) * 1000;
      const max = parseFloat(UI.inputDelayMax.value) * 1000;
      await Utils.sleep(Math.floor(Math.random() * (max - min + 1) + min));
    }
  }

  State.isAutoRunning = false;
  Utils.updateAutoUI(false);
  UI.autoStatusLabel.innerText = State.isAutoRunning ? "Berhenti." : "Selesai antrean.";
});

UI.btnAutoStop.addEventListener('click', () => {
  State.isAutoRunning = false;
  Utils.updateAutoUI(false);
  UI.autoStatusLabel.innerText = "Berhenti paksa...";
});

// ==========================================
// 4. SCANNER
// ==========================================
UI.btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    Utils.updateStatus("Error: Bukan Tokopedia", "red");
    return;
  }

  Utils.updatePageIndicator(tab.url);
  Utils.updateStatus("Sedang memindai...", "orange");

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    if (chrome.runtime.lastError) return Utils.updateStatus("Gagal inject.", "red");
    
    chrome.tabs.sendMessage(tab.id, { action: "scrape_visible" }, (response) => {
      if (chrome.runtime.lastError) return Utils.updateStatus("Koneksi putus.", "red");
      if (response && response.status === "success") {
        processNewData(response.data);
      } else {
        Utils.updateStatus("Gagal baca data.", "red");
      }
    });
  });
});

// ==========================================
// 5. PROCESSING & RENDER
// ==========================================
function processNewData(items) {
  let newCount = 0;
  items.forEach(item => {
    if (item.productUrl && !State.uniqueUrls.has(item.productUrl)) {
      item.shopUsername = Utils.extractUsername(item.productUrl);
      const parsedShop = Utils.parseShopData(item.shopLocation);
      item.cleanShopName = parsedShop.name;
      item.cleanLocation = parsedShop.location;

      item.originalPrice = item.price; 
      item.price = DataFormatter.price(item.price); 
      item.originalRating = item.rating;
      item.rating = DataFormatter.rating(item.rating);
      item.originalSold = item.sold;
      item.sold = DataFormatter.sold(item.sold); 
      item.timestamp = Date.now();

      State.uniqueUrls.add(item.productUrl);
      State.collectedData.push(item);
      renderItem(item);
      newCount++;
    }
  });
  
  UI.countLabel.innerText = State.collectedData.length;
  if (newCount > 0) {
    Utils.updateStatus(`+${newCount} produk.`, "green");
    UI.btnExport.disabled = false;
    if (UI.searchInput.value.trim() !== "") runFilter();
  }
}

function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  div.style.cursor = 'pointer'; 
  
  const uniqueId = btoa(item.productUrl).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  div.setAttribute('data-url', item.productUrl); 

  let badgeColor = "#999"; let badgeText = "Reg";
  if (item.shopBadge === "Mall") { badgeColor = "#D6001C"; badgeText = "Mall"; }
  else if (item.shopBadge === "Power Shop") { badgeColor = "#00AA5B"; badgeText = "Pro"; }

  div.innerHTML = `
    <img src="${item.imageUrl}" class="item-thumb" alt="img">
    <div class="item-info">
      <div class="item-title" title="${item.name}">${item.name}</div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="item-price">${item.originalPrice}</span>
        <span class="item-meta" style="color:#fa591d;">★ ${item.rating} | ${item.originalSold}</span>
      </div>
      <div class="item-shop">📍 ${item.cleanLocation} (${item.shopUsername})</div>
      <div class="action-row">
        <div style="display:flex; align-items:center; overflow:hidden;">
           <span class="shop-badge" style="background:${badgeColor};">${badgeText}</span>
           <span class="item-shop" style="max-width: 80px;">${item.cleanShopName}</span>
        </div>
        <div style="display:flex; gap:4px; flex-shrink:0;">
          <button class="btn-mini delete" title="Hapus">🗑️</button>
          <button class="btn-mini open btn-open-scrape">🔗 Detail</button>
        </div>
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

  // Listeners
  div.addEventListener('click', async (e) => {
    if (e.target.closest('button') || e.target.closest('.detail-box')) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { action: "highlight_item", url: item.productUrl }).catch(e=>{});
  });

  const btnDelete = div.querySelector('.delete');
  btnDelete.onclick = (e) => {
    e.stopPropagation();
    div.remove();
    State.collectedData = State.collectedData.filter(d => d.productUrl !== item.productUrl);
    State.uniqueUrls.delete(item.productUrl);
    UI.countLabel.innerText = State.collectedData.length;
    if (UI.searchInput.value.trim() !== "") runFilter();
    if (State.collectedData.length === 0) { UI.btnExport.disabled = true; Utils.updateStatus("List kosong.", "#666"); }
  };

  const btnOpen = div.querySelector('.btn-open-scrape');
  const detailBox = div.querySelector(`#detail-${uniqueId}`);
  btnOpen.onclick = (e) => {
    e.stopPropagation();
    btnOpen.classList.add('processed');
    btnOpen.innerText = "⏳";
    btnOpen.disabled = true;
    detailBox.classList.add('visible');
    
    const isActive = !State.isAutoRunning; 
    chrome.tabs.create({ url: item.productUrl, active: isActive }, (newTab) => {
      const listener = (tabId, changeInfo, tab) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['pdp_patterns.js', 'pdp_scraper.js'] });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  };

  UI.resultsContainer.appendChild(div); 
}

function handlePDPData(url, data, senderTabId) {
  const cleanUrl = url.split('?')[0];
  const itemDiv = document.querySelector(`div[data-url^="${cleanUrl}"]`);
  
  if (senderTabId) chrome.tabs.remove(senderTabId);
  if (!itemDiv) return;

  const uniqueId = btoa(itemDiv.getAttribute('data-url')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const detailBox = document.getElementById(`detail-${uniqueId}`);
  const btnOpen = itemDiv.querySelector('.btn-open-scrape');

  if (btnOpen) {
    btnOpen.innerText = "✔";
    btnOpen.style.borderColor = "#ccc";
    btnOpen.style.color = "#ccc";
  }

  if (detailBox) {
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
  }

  const dataIndex = State.collectedData.findIndex(d => d.productUrl === itemDiv.getAttribute('data-url'));
  if (dataIndex !== -1) {
    State.collectedData[dataIndex].details = data;
  }
}

// ==========================================
// 6. EXPORT
// ==========================================
UI.btnExport.addEventListener('click', () => {
  if (State.collectedData.length === 0) return Utils.updateStatus("Kosong", "red");
  
  const shopsMap = new Map();

  State.collectedData.forEach(item => {
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
      price: item.price, 
      rating: item.rating, 
      sold: item.sold, 
      originalPrice: item.originalPrice, 
      originalSold: item.originalSold,
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