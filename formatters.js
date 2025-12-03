// formatters.js

const DataFormatter = {
  /**
   * Mengubah "Rp1.400.000" -> 1400000 (Integer)
   */
  price: (priceStr) => {
    if (!priceStr) return 0;
    // Hapus semua karakter yang bukan angka
    const cleanStr = priceStr.replace(/\D/g, ''); 
    return parseInt(cleanStr, 10) || 0;
  },

  /**
   * Mengubah "4.9" -> 4.9 (Float/Number)
   * JSON Standard menggunakan titik (.) untuk desimal.
   */
  rating: (ratingStr) => {
    if (!ratingStr || ratingStr === '-') return 0;
    // Ganti koma jadi titik (jaga-jaga), lalu parse
    const floatVal = parseFloat(ratingStr.replace(',', '.'));
    return isNaN(floatVal) ? 0 : floatVal;
  },

  /**
   * Mengubah "100+ terjual" -> 101 (Integer)
   * Mengubah "750 terjual" -> 750
   * Menangani "1rb+" -> 1001 (Opsional, untuk robustness)
   */
  sold: (soldStr) => {
    if (!soldStr) return 0;
    
    const lowerStr = soldStr.toLowerCase();
    
    // 1. Ambil angkanya saja (termasuk koma/titik desimal jika ada, misal 1.5rb)
    // Regex: ambil digit, titik, atau koma di awal string
    const match = lowerStr.match(/[\d,\.]+/);
    if (!match) return 0;

    let baseNumber = parseFloat(match[0].replace(',', '.'));

    // 2. Cek Multiplier (rb = ribu, jt = juta)
    if (lowerStr.includes('rb') || lowerStr.includes('ribuan')) {
      baseNumber *= 1000;
    } else if (lowerStr.includes('jt') || lowerStr.includes('juta')) {
      baseNumber *= 1000000;
    }

    // 3. Cek tanda Plus (+)
    // Jika ada plus, tambahkan 1
    if (lowerStr.includes('+')) {
      baseNumber += 1;
    }

    return Math.floor(baseNumber); // Pastikan integer
  }
};