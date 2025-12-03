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

// ==========================================
// 2. HANDLER SCRAPING
// ==========================================
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Buka halaman Tokopedia dulu!", "red");
    return;
  }

  updateStatus("Sedang memindai...", "orange");

  // Injeksi file secara berurutan: Patterns -> Content Script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    
    if (chrome.runtime.lastError) {
      console.error("Injection Error:", chrome.runtime.lastError);
      updateStatus("Gagal inject script. Refresh halaman.", "red");
      return;
    }

    // Kirim pesan untuk mulai scraping
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
// 3. PENGOLAHAN DATA (PARSING)
// ==========================================
function processNewData(items) {
  let newCount = 0;

  items.forEach(item => {
    // Validasi Duplikat
    if (item.productUrl && !uniqueUrls.has(item.productUrl)) {
      
      // A. Ekstrak Username Toko dari URL
      item.shopUsername = extractUsername(item.productUrl);

      // B. Pisahkan Nama Toko dan Lokasi
      const parsedShop = parseShopData(item.shopLocation);
      item.cleanShopName = parsedShop.name;
      item.cleanLocation = parsedShop.location;

      uniqueUrls.add(item.productUrl);
      collectedData.push(item);
      renderItem(item); // Tampilkan ke UI
      newCount++;
    }
  });

  // Update UI Stats
  countLabel.innerText = collectedData.length;
  
  if (newCount > 0) {
    updateStatus(`+${newCount} produk baru. Scroll lagi!`, "green");
    btnExport.disabled = false;
  } else {
    updateStatus("Tidak ada produk baru di layar.", "#666");
  }
}

// --- Helper Functions ---

function parseShopData(combinedString) {
  if (!combinedString) return { name: "-", location: "-" };
  const parts = combinedString.split(" - ");
  
  // Jika format tidak sesuai standar
  if (parts.length === 1) return { name: parts[0], location: "-" };
  
  // Asumsi: Bagian terakhir adalah lokasi, sisanya nama toko
  const location = parts.pop(); 
  const name = parts.join(" - "); 
  return { name, location };
}

function extractUsername(urlString) {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/');
    // Segmen 1 biasanya username toko (index 0 kosong karena slash awal)
    if (segments.length > 1 && segments[1]) return segments[1];
    return "-";
  } catch (e) { return "-"; }
}

function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}

// ==========================================
// 4. RENDERING UI (DENGAN LINK HELPER)
// ==========================================
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  
  // A. Bagian Statis (HTML String)
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
        ${item.rating ? `⭐ ${item.rating}` : ''} 
        ${item.sold ? ` | ${item.sold}` : ''}
      </div>
      
      <div class="action-row" style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
        </div>
      
      <div style="font-size: 9px; color: #888; margin-top: 2px;">
         📍 ${item.cleanLocation} (${item.shopUsername})
      </div>
    </div>
  `;

  // B. Bagian Dinamis (Badge & Tombol Link)
  const actionRow = div.querySelector('.action-row');

  // 1. Buat Badge Toko
  let badgeColor = "#999"; 
  let badgeText = "Regular";
  
  if (item.shopBadge === "Mall") {
    badgeColor = "#D6001C"; 
    badgeText = "Mall";
  } else if (item.shopBadge === "Power Shop") {
    badgeColor = "#00AA5B"; 
    badgeText = "Power Pro";
  }

  const badgeSpan = document.createElement('span');
  badgeSpan.style.cssText = `background:${badgeColor}; color:white; padding: 1px 4px; border-radius:3px; font-weight:bold; font-size:9px; margin-right:5px;`;
  badgeSpan.innerText = badgeText;
  
  const shopNameSpan = document.createElement('span');
  shopNameSpan.style.cssText = "font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;";
  shopNameSpan.innerText = item.cleanShopName;

  // Gabungkan Info Toko
  const leftSide = document.createElement('div');
  leftSide.style.display = "flex";
  leftSide.style.alignItems = "center";
  leftSide.appendChild(badgeSpan);
  leftSide.appendChild(shopNameSpan);
  actionRow.appendChild(leftSide);

  // 2. Buat Tombol Link (Menggunakan LinkHelper)
  const btnLink = document.createElement('button');
  btnLink.innerText = "🔗 Buka";
  btnLink.style.cssText = "border: 1px solid #ccc; background: #fff; border-radius: 3px; cursor: pointer; font-size: 9px; padding: 1px 5px; margin-left: 5px;";
  
  // Attach Event Listener Generik
  if (typeof LinkHelper !== 'undefined') {
    LinkHelper.attach(btnLink, item.productUrl);
  } else {
    // Fallback jika LinkHelper lupa dimuat
    btnLink.onclick = () => window.open(item.productUrl, '_blank');
  }

  actionRow.appendChild(btnLink);

  // C. Masukkan ke Container Utama (APPEND = Urutan sesuai halaman)
  resultsContainer.appendChild(div); 
}

// ==========================================
// 5. EXPORT CSV
// ==========================================
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) return;
  
  const headers = [
    "Jenis Toko",
    "Username Toko",
    "Nama Toko",
    "Lokasi Toko",
    "Nama Produk", 
    "Harga", 
    "Rating", 
    "Terjual", 
    "Link Gambar", 
    "Link Produk"
  ];
  
  const csvRows = collectedData.map(item => {
    return [
      escapeCsv(item.shopBadge),
      escapeCsv(item.shopUsername),
      escapeCsv(item.cleanShopName),
      escapeCsv(item.cleanLocation),
      escapeCsv(item.name),
      escapeCsv(item.price),
      escapeCsv(item.rating),
      escapeCsv(item.sold),
      escapeCsv(item.imageUrl),
      escapeCsv(item.productUrl)
    ].join(",");
  });

  const csvContent = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.setAttribute("href", url);
  link.setAttribute("download", `tokopedia_scrape_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

function escapeCsv(text) {
  if (!text) return '""';
  const str = String(text);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}