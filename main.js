const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function savePath() {
  return path.join(app.getPath('userData'), 'save.json');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('save:load', async () => {
  try {
    return await fs.promises.readFile(savePath(), 'utf8');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('save:write', async (_event, obj) => {
  try {
    const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
    await fs.promises.mkdir(path.dirname(savePath()), { recursive: true });
    await fs.promises.writeFile(savePath(), text, 'utf8');
    return true;
  } catch (e) {
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
