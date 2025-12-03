window.AppState = {
  // Data Utama
  collectedData: [],
  uniqueUrls: new Set(),
  
  // Status Bot
  isAutoRunning: false,

  // UI Cache
  UI: {
    btnScrape: document.getElementById('btnScrape'),
    btnExport: document.getElementById('btnExport'),
    
    // Automation Controls
    btnAutoStart: document.getElementById('btnAutoStart'),
    btnAutoStop: document.getElementById('btnAutoStop'),
    inputDelayMin: document.getElementById('delayMin'),
    inputDelayMax: document.getElementById('delayMax'),
    autoStatusLabel: document.getElementById('auto-status'),
    
    // Search & Filter
    searchInput: document.getElementById('searchInput'),
    toggleNot: document.getElementById('toggleNot'),
    btnBulkDelete: document.getElementById('btnBulkDelete'), // <-- NEW
    filteredCountLabel: document.getElementById('filtered-count'),
    
    // Sort
    sortBySelect: document.getElementById('sortBy'),
    sortOrderSelect: document.getElementById('sortOrder'),
    
    // Status & Containers
    statusMsg: document.getElementById('status-msg'),
    countLabel: document.getElementById('count'),
    resultsContainer: document.getElementById('results'),
    pageTypeIndicator: document.getElementById('page-type-indicator')
  },

  // Reset helper
  reset: function() {
    this.collectedData = [];
    this.uniqueUrls.clear();
    this.isAutoRunning = false;
  }
};