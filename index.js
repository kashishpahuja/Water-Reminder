const { app, BrowserWindow, screen, ipcMain, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');

let reminderWindow = null;
let settingsWindow = null;
let reminderTimer = null;
let tray = null;
let isPaused = false;

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(data);
      if (!parsed.intervalMinutes || parsed.intervalMinutes < 1) {
        parsed.intervalMinutes = 20;
      }
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load settings', err);
  }
  return { intervalMinutes: 20, gifPath: 'crow.gif' };
}

function saveSettings(newSettings) {
  try {
    const current = loadSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(settingsPath, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save settings', err);
  }
}

function createReminderWindow() {
  if (isPaused) return;
  if (reminderWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const windowWidth = width;
  const windowHeight = height;

  reminderWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: 0, 
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  reminderWindow.loadFile('index.html');

  // Ignore mouse events globally across the full screen so background apps work normally
  reminderWindow.setIgnoreMouseEvents(true, { forward: true });

  reminderWindow.on('closed', () => {
    reminderWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 450,
    height: 500,
    title: 'Water Reminder Settings',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Function to schedule timer dynamically
function scheduleReminderTimer(minutes) {
  if (reminderTimer) clearInterval(reminderTimer);

  const intervalTime = minutes * 60 * 1000;
  console.log(`Next reminder scheduled in ${minutes} minute(s).`);

  reminderTimer = setInterval(() => {
    if (!isPaused) {
      createReminderWindow();
    }
  }, intervalTime);
}

// Reset using user settings default (20 mins or custom)
function resetReminderTimerToDefault() {
  const settings = loadSettings();
  const minutes = settings.intervalMinutes && settings.intervalMinutes >= 1 ? settings.intervalMinutes : 20;
  scheduleReminderTimer(minutes);
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Water Reminder Active', enabled: false },
    { type: 'separator' },
    { label: '⚙ Settings', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: '❌ Exit App', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Water Reminder (Running)');
}

app.whenReady().then(() => {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath
  });

  ipcMain.handle('get-settings', async () => {
    return loadSettings();
  });

  ipcMain.on('save-settings', (event, data) => {
    saveSettings({
      intervalMinutes: data.interval,
      gifPath: data.gifPath
    });
    resetReminderTimerToDefault();
    if (settingsWindow) settingsWindow.close();
  });

  // Listen for mouse event toggle from frontend container hover
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    if (reminderWindow) {
      reminderWindow.setIgnoreMouseEvents(ignore, options);
    }
  });

  // Listen for actions from the reminder popup buttons
  ipcMain.on('reminder-action', (event, actionType) => {
    if (actionType === 'done') {
      resetReminderTimerToDefault();
    } else if (actionType === 'snooze') {
      scheduleReminderTimer(5);
    }
  });

  // 1. Show immediately on start
  createReminderWindow();

  // 2. Start the default interval loop
  resetReminderTimerToDefault();

  // Safe tray initialization
  const iconPath = path.join(__dirname, 'crow.gif');
  if (fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
    updateTrayMenu();
  } else {
    console.warn('Tray icon path not found, running without tray icon.');
  }
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});