const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

log.transports.file.level = 'info';
autoUpdater.logger = log;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(
        path.join(__dirname, 'dist/app-carreras/browser/index.html')
    );
}

app.whenReady().then(() => {
    createWindow();

    if (app.isPackaged) {
        autoUpdater.autoDownload = true;
        autoUpdater.checkForUpdatesAndNotify();
    }
});

autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
        mainWindow.setProgressBar(progress.percent / 100);
        mainWindow.setTitle(`Descargando actualización ${Math.round(progress.percent)}%`);
    }
});

autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.setProgressBar(-1);

    dialog.showMessageBox({
        type: 'info',
        buttons: ['Reiniciar ahora', 'Después'],
        title: 'Actualización lista',
        message: 'La nueva versión está lista. ¿Deseas reiniciar ahora?'
    }).then(result => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.checkForUpdates().catch(err => {
    log.error('Error buscando actualización:', err);
});
