// Variabel Global untuk menyimpan state
let collectedData = []; 
let uniqueUrls = new Set(); 

// Referensi Elemen UI
const btnScrape = document.getElementById('btnScrape');
const btnExport = document.getElementById('btnExport');
const statusMsg = document.getElementById('status-msg');
const countLabel = document.getElementById('count');
const resultsContainer = document.getElementById('results');

// ==========================================
// 1. HANDLER TOMBOL SCRAPE (Scan Layar)
// ==========================================
btnScrape.addEventListener('click', async () => {
  // Ambil tab aktif saat ini
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Validasi: Pastikan user ada di Tokopedia
  if (!tab.url.includes('tokopedia.com')) {
    updateStatus("Error: Buka halaman Tokopedia dulu!", "red");
    return;
  }

  updateStatus("Sedang memindai...", "orange");

  // INJEKSI SCRIPT
  // Urutan file PENTING: patterns.js dulu, baru content.js
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['patterns.js', 'content.js'] 
  }, () => {
    
    // Cek jika ada error browser/permission saat inject
    if (chrome.runtime.lastError) {
      console.error("Injection Error:", chrome.runtime.lastError);
      updateStatus("Gagal inject script. Coba refresh halaman.", "red");
      return;
    }

    // Kirim pesan ke content.js untuk mulai 'membaca' DOM
    chrome.tabs.sendMessage(tab.id, { action: "scrape_visible" }, (response) => {
      
      // Cek error koneksi (misal tab tertutup atau refresh saat loading)
      if (chrome.runtime.lastError) {
        updateStatus("Koneksi terputus. Refresh halaman.", "red");
        return;
      }

      if (response && response.status === "success") {
        processNewData(response.data);
      } else {
        updateStatus("Gagal membaca data dari halaman.", "red");
      }
    });
  });
});

// ==========================================
// 2. PEMROSESAN DATA (Filter & Simpan)
// ==========================================
function processNewData(items) {
  let newCount = 0;

  items.forEach(item => {
    // Filter Duplikat: Hanya masukkan jika URL belum pernah ada
    if (item.productUrl && !uniqueUrls.has(item.productUrl)) {
      uniqueUrls.add(item.productUrl);
      collectedData.push(item);
      renderItem(item); // Tampilkan ke UI
      newCount++;
    }
  });

  // Update statistik
  countLabel.innerText = collectedData.length;
  
  if (newCount > 0) {
    updateStatus(`+${newCount} produk ditambahkan. Scroll lagi!`, "green");
    btnExport.disabled = false;
  } else {
    updateStatus("Tidak ada produk baru di area ini. Scroll lagi.", "#666");
  }
}

// ==========================================
// 3. RENDER UI (Menampilkan List)
// ==========================================
function renderItem(item) {
  const div = document.createElement('div');
  div.className = 'item-preview'; // Pastikan class ini ada di styles.css
  
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
      
      <div style="font-size: 10px; color: #888; margin-top: 2px;">
        ${item.shopLocation || '-'}
      </div>
      
    </div>
  `;
  
  // PERBAIKAN URUTAN: Menggunakan appendChild
  // Data baru ditaruh di BAWAH (sesuai urutan baca halaman)
  resultsContainer.appendChild(div); 
}

// ==========================================
// 4. EXPORT KE CSV
// ==========================================
btnExport.addEventListener('click', () => {
  if (collectedData.length === 0) return;
  
  const headers = [
    "Nama Produk", 
    "Harga", 
    "Rating", 
    "Terjual", 
    "Toko & Lokasi", 
    "Link Gambar", 
    "Link Produk"
  ];
  
  // Mapping data ke baris CSV
  const csvRows = collectedData.map(item => {
    return [
      escapeCsv(item.name),
      escapeCsv(item.price),
      escapeCsv(item.rating),
      escapeCsv(item.sold),
      escapeCsv(item.shopLocation),
      escapeCsv(item.imageUrl),
      escapeCsv(item.productUrl)
    ].join(",");
  });

  // Gabungkan Header + Isi
  const csvContent = [headers.join(","), ...csvRows].join("\n");
  
  // Buat Blob & Download
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

// Helper: Escape CSV (mengamankan koma & kutip)
function escapeCsv(text) {
  if (!text) return '""';
  const str = String(text);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

// Helper: Update Status Text
function updateStatus(text, color) {
  statusMsg.innerText = text;
  statusMsg.style.color = color;
}