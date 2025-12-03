// Variabel Global
let collectedData = []; 
let uniqueUrls = new Set(); 

// Referensi Elemen UI
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');

// 1. HANDLER TOMBOL SCRAPE
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Buka halaman Tokopedia dulu!", "red");
    return;
  }

  updateStatus("Sedang memindai...", "orange");

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Injection Error:", chrome.runtime.lastError);
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

// 2. LOGIKA UTAMA
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
    updateStatus(`+${newCount} produk. Scroll lagi!`, "green");
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

// 3. RENDER UI (Dengan Badge)
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview';
  
  // Tentukan warna badge
  let badgeColor = "#888"; // Abu-abu (Regular)
  let badgeText = item.shopBadge;
  
  if (item.shopBadge === "Mall") {
    badgeColor = "#D6001C"; // Merah
  } else if (item.shopBadge === "Power Shop") {
    badgeColor = "#00AA5B"; // Hijau
    badgeText = "Power Pro"; // Singkat aja biar muat
  }

  div.innerHTML = `
    <img src="${item.imageUrl}" alt="img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">
    <div style="flex: 1; overflow: hidden; padding-left: 10px; display: flex; flex-direction: column; justify-content: center;">
      
      <div style="font-weight:600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333;" title="${item.name}">
        ${item.name}
      </div>
      
      <div style="color: #00AA5B; font-weight: bold; font-size: 12px; margin-top: 2px;">
        ${item.price}
      </div>
      
      <div style="font-size: 10px; color: #555; margin-top: 3px; display: flex; align-items: center; gap: 4px;">
        <span style="background:${badgeColor}; color:white; padding: 1px 4px; border-radius:3px; font-weight:bold; font-size:9px;">
          ${badgeText}
        </span>
        <span>${item.cleanShopName}</span>
      </div>
      
      <div style="font-size: 10px; color: #888; margin-top: 1px;">
         📍 ${item.cleanLocation} | ${item.shopUsername}
      </div>
    </div>
  `;
  
  resultsContainer.appendChild(div); 
}

// 4. EXPORT CSV (Updated)
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) return;
  
  const headers = [
    "Jenis Toko", // Kolom Baru: Mall / Power Shop / Regular
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
      escapeCsv(item.shopBadge), // Data Badge
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

function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}