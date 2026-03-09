const { app, BrowserWindow } = require('electron');
const path = require('path');

require('./schema'); // runs schema file on startup creates all 5 tables if they dont exist

function createWindow() {    // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {    // these two settings let your HTML/JS files talk directly to Node.js and your database.
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hiddenInset', //gives it that clean Mac look where the traffic light buttons float over your content instead of sitting in a grey bar
    title: 'Small Biz App',
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => { //Electron is async, so you have to wait for it to be ready before creating a window. This is the Electron equivalent of document.addEventListener('DOMContentLoaded')
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { //on Mac, apps don't quit when you close the window — they stay in the dock. This block handles that Mac-specific behavior correctly.
  if (process.platform !== 'darwin') app.quit();
});