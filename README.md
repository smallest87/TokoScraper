# TokoScraper 🛒

**TokoScraper** adalah Chrome Extension berbasis Side Panel (Manifest V3) yang dirancang untuk memperbaiki pengalaman pencarian dan pengambilan data produk di Tokopedia. Alat ini memberikan kendali penuh kepada pengguna untuk memfilter, mengurutkan, dan mengekstraksi data produk secara presisi.

---

## 💡 Motivasi & Latar Belakang

Kenapa *tool* ini dibuat? Sederhana: **Pencarian Tokopedia seringkali tidak akurat.**

Pengguna sering menghadapi masalah berikut:
* **Keyword Meleset:** Mencari produk "A", namun hasil yang muncul tercampur dengan "B", "C", dan "D".
* **Spam Produk:** Terlalu banyak produk selipan (iklan/rekomendasi) yang tidak relevan membanjiri hasil pencarian.
* **Sorting Tidak Jujur:** Urutan rekomendasi jarang menampilkan harga yang paling ekonomis di peringkat atas, melainkan berdasarkan algoritma yang tidak transparan.

Alat ini berfungsi untuk menambal kelemahan tersebut. Kami melakukan *scraping* data layar secara *real-time*, lalu membiarkan Anda melakukan filterisasi "Hard Logic" (Strict Mode) dan menyortir harga secara *real integer*, memastikan Anda mendapatkan barang yang **tepat** dengan harga **terbaik**.

---

## ✨ Fitur Utama

### 1. 🔍 Strict Filtering & Searching
* **Realtime Search:** Cari produk di dalam list hasil scraping tanpa loading ulang.
* **NOT Logic Filter:** Sembunyikan produk yang mengandung kata kunci tertentu (misal: hapus semua produk dengan kata "Kabel" atau "Bekas").
* **Bulk Delete:** Hapus massal produk hasil filteran sampah hanya dengan satu klik.

### 2. 💰 True Price Sorting
Mengurutkan produk berdasarkan **nilai nominal (integer)** yang sebenarnya, bukan string teks. Anda bisa melihat produk termurah atau termahal secara akurat.

### 3. 🤖 Auto Detail Scraper (Bot)
Secara otomatis membuka halaman detail produk di tab latar belakang, mengambil data mendalam (Stok, Deskripsi Lengkap, Gambar High-Res), lalu menutup tab tersebut secara otomatis untuk menghemat memori.

### 4. 📂 Export to Nested JSON
Data diekspor dalam format JSON terstruktur dengan relasi hierarki:
`Toko` -> `List Produk` -> `Detail Produk`. Format ini siap digunakan untuk analisis data lebih lanjut.

### 5. 👁️ Bi-directional Interaction
* **Highlight:** Klik item di Sidepanel, dan halaman Tokopedia akan otomatis *scroll* dan menyorot (highlight merah) produk aslinya di browser.
* **Smart Detection:** Otomatis mendeteksi apakah Anda sedang di halaman Pencarian, Beranda Toko, atau Detail Produk.

---

## 🛠️ Struktur Proyek

Pastikan susunan file dalam folder proyek Anda seperti berikut:

```text
my-scraper/
├── manifest.json        # Konfigurasi ekstensi (Permissions & Host)
├── background.js        # Service worker untuk event klik icon
├── sidepanel.html       # Antarmuka pengguna (UI)
├── sidepanel.js         # Logika utama (Controller UI & Event Listener)
├── styles.css           # Styling tampilan panel
├── content.js           # Script injeksi untuk scraping listing produk
├── patterns.js          # Konfigurasi Regex & Selector (Heuristic)
├── pdp_scraper.js       # Script injeksi khusus halaman detail produk
├── pdp_patterns.js      # Konfigurasi selector halaman detail
├── linkHelper.js        # Utilitas manajemen tab & sesi
├── formatters.js        # Utilitas pembersihan tipe data (Rp -> Int)
├── state.js             # Manajemen state global (Memori)
├── utils.js             # Fungsi bantuan umum
└── icons/               # Folder ikon aplikasi
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## 🚀 Cara Instalasi
Karena ekstensi ini bersifat custom (belum ada di Chrome Web Store), Anda perlu menginstalnya dalam mode pengembang:
 * Download/Clone repositori ini ke komputer Anda.
 * Buka Google Chrome dan ketik chrome://extensions di address bar.
 * Aktifkan Developer mode (tombol toggle di pojok kanan atas).
 * Klik tombol Load unpacked (pojok kiri atas).
 * Pilih folder proyek TokoScraper Anda.
 * Selesai! Ikon TokoScraper akan muncul di toolbar Chrome.

### 📖 Cara Penggunaan
#### Langkah 1: Scanning Awal
 * Buka situs Tokopedia dan lakukan pencarian produk (misal: "Mic Maono").
 * Klik ikon TokoScraper di toolbar untuk membuka Sidepanel.
 * Klik tombol "📷 Scan Halaman".
 * Lakukan scroll manual pada halaman Tokopedia untuk memuat lebih banyak produk, lalu klik "📷 Scan Halaman" lagi. Data baru akan ditambahkan tanpa duplikasi.

#### Langkah 2: Kurasi Data (Cleaning)
 * Gunakan kotak pencarian di Sidepanel untuk memfilter produk.
 * Gunakan tombol NOT untuk membuang produk yang tidak diinginkan.
 * Klik tombol 🗑️ All untuk menghapus massal produk sampah yang sedang tampil.
 * Gunakan dropdown Sort untuk mengurutkan berdasarkan Harga Termurah atau Rating Tertinggi.

#### Langkah 3: Ambil Detail (Deep Scraping)
 * Buka panel "🤖 Auto Detail Scraper".
 * Atur delay (misal Min: 3 detik, Max: 6 detik) untuk menghindari deteksi bot.
 * Klik "▶ Mulai Auto".
 * Ekstensi akan otomatis membuka tab produk satu per satu, mengambil data stok & deskripsi, lalu menutupnya.

#### Langkah 4: Simpan Data
 * Setelah puas dengan data yang terkumpul, klik tombol "💾 Export JSON".
 * File JSON akan terunduh dengan nama tokopedia_data_[timestamp].json.

### ⚠️ Disclaimer
Proyek ini dibuat untuk tujuan edukasi dan produktivitas pribadi.
 * Penulis tidak bertanggung jawab atas penyalahgunaan alat ini.
 * Gunakan dengan bijak dan delay yang wajar agar tidak membebani server Tokopedia.
 * Struktur HTML Tokopedia dapat berubah sewaktu-waktu yang mungkin menyebabkan alat ini perlu diperbarui (update patterns.js).
Happy Scraping! 🕵

## 👥 PARA SPONSOR
Masih menunggu orang-orang baik

## 💰 DONASI

### LINK DONASI
1. [SAWERIA](https://saweria.co/juliansukrisna) - QRIS, GoPay, OVO, Dana, LinkAja
2. [Lynk.id](https://lynk.id/smallest87/gg8dgvjk0dpl/checkout) ShoopePay, OVO, QRIS, Dana, Virtual Account, Credt Card
2. [SOCIABUZZ](https://sociabuzz.com/juliansukrisna/tribe) - eWallet, QRIS, Bank Transfer, Retail Outlet, Credit Card
3. [TRAKTEER](https://teer.id/juliansukrisna)

### 📢 STATUS DONASI:
```
OPERASIONAL BULANAN
Biaya Hidup & Menghidupi (DES '25)
█|░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░| IDR  6.000.000 |
Terkumpul: IDR 0,00 (0%)

Biaya Sewa/Beli Developer Tools (DES '25)
█|░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░| IDR  2.000.000 |
Terkumpul: IDR 0,00 (0%)
====================================================
Target Impian:
14-inch MacBook Pro M4
█|░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░| IDR 26.499.000 |
Terkumpul: IDR 0,00 (0%)
```
