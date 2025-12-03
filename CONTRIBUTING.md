# Berkontribusi pada TokoScraper

Terima kasih atas minat Anda untuk berkontribusi pada TokoScraper! Proyek ini bersifat *open-source* dan dibuat untuk tujuan edukasi. Mengingat struktur HTML situs target (Tokopedia) yang sering berubah, kontribusi komunitas sangat dihargai.

## Cara Berkontribusi

### 1. Melaporkan Bug
Jika Anda menemukan *bug* (misalnya: *selector* tidak lagi berfungsi karena update situs), silakan buat **Issue** baru dengan format:
- **Deskripsi:** Apa yang salah?
- **URL Target:** Di halaman mana error terjadi?
- **Screenshot/Log:** Lampirkan error dari Console (F12) jika ada.

### 2. Mengusulkan Fitur
Punya ide fitur baru? Buka diskusi melalui **Issue** sebelum membuat kode, agar kita bisa membahas desain teknisnya terlebih dahulu.

### 3. Pull Request (PR)
1.  **Fork** repositori ini.
2.  Buat **Branch** baru untuk fitur/fix Anda (`git checkout -b fitur-keren-baru`).
3.  Lakukan perubahan.
    * Jika Anda memperbaiki *selector*, pastikan update `patterns.js` atau `pdp_patterns.js`.
    * Jika Anda mengubah logika UI, pastikan modularitas di `state.js` dan `sidepanel.js` tetap terjaga.
4.  **Commit** perubahan Anda (`git commit -m 'Menambahkan fitur X'`).
5.  **Push** ke branch Anda (`git push origin fitur-keren-baru`).
6.  Buat **Pull Request** ke branch `main` repositori ini.

## Panduan Pengembangan

* **Tanpa Framework:** Proyek ini menggunakan Vanilla JS (ES6+). Hindari penggunaan library berat seperti jQuery atau React kecuali benar-benar diperlukan.
* **Modularitas:**
    * `patterns.js`: Simpan Regex dan Selector di sini.
    * `state.js`: Simpan variabel global di sini.
    * `utils.js`: Simpan fungsi helper murni di sini.
* **Manifest V3:** Pastikan kode mematuhi standar keamanan Chrome Extension Manifest V3 (tidak ada *remote code execution*).

## Etika & Disclaimer
Proyek ini adalah alat bantu produktivitas dan edukasi. **Jangan** mengirimkan PR yang berisi fitur untuk:
- Melakukan *spamming* ke server target.
- Membypass sistem keamanan (CAPTCHA, Login, dsb).
- Mengambil data pribadi pengguna lain.

Terima kasih telah membantu membuat TokoScraper lebih baik!
