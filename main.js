const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let isInstallingUpdate = false;

log.transports.file.level = 'debug';
autoUpdater.logger = log;

// importante en Windows
app.setAppUserModelId('com.app.carreras');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true
    }
  });

  mainWindow.loadFile(
    path.join(__dirname, 'dist/app-carreras/browser/index.html')
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdates();
  }
});

autoUpdater.on('checking-for-update', () => {
  log.info('Buscando actualizaciones...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Actualización disponible:', info);
});

autoUpdater.on('update-not-available', (info) => {
  log.info('No hay actualizaciones:', info);
});

autoUpdater.on('error', (err) => {
  log.error('Error en autoUpdater:', err);
});

autoUpdater.on('download-progress', (progress) => {
  log.info(`Descargando: ${progress.percent}%`);

  if (mainWindow) {
    mainWindow.setProgressBar(progress.percent / 100);
    mainWindow.setTitle(
      `Descargando actualización ${Math.round(progress.percent)}%`
    );
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Actualización descargada:', info);

  if (mainWindow) {
    mainWindow.setProgressBar(-1);
    mainWindow.setTitle(`App Carreras v${app.getVersion()}`);
  }

  dialog.showMessageBox({
    type: 'info',
    buttons: ['Reiniciar ahora', 'Después'],
    defaultId: 0,
    cancelId: 1,
    title: 'Actualización lista',
    message: 'La nueva versión está lista. ¿Deseas reiniciar ahora?'
  }).then(result => {
    if (result.response === 0) {
      isInstallingUpdate = true;
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('before-quit');
});

app.on('quit', () => {
  log.info('quit');
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});