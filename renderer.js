const { ipcRenderer } = require('electron');

// Automatically close the window after 3 seconds (3000 ms)
const autoCloseTimer = setTimeout(() => {
  window.close();
}, 3000);

document.getElementById('dismissBtn').addEventListener('click', () => {
  clearTimeout(autoCloseTimer); // Clear auto-close so it doesn't fire twice
  window.close();
});

document.getElementById('drunkBtn').addEventListener('click', () => {
  clearTimeout(autoCloseTimer);
  // You can add extra logging or action here when they click "Drank!"
  window.close();
});