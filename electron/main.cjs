const { app, BrowserWindow } = require('electron');
const path = require('path');
const log = require('electron-log');
const db = require('./database.cjs');
const meet = require('./meet.cjs');
const consistency = require('./ipc/consistency.cjs');
const generator = require('./ipc/generator.cjs');

log.initialize();
log.info('App starting...');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
  log.info('Main window created');
}

app.whenReady().then(() => {
  log.info('Initializing database...');
  db.runMigrations();
  db.prepareStatements();
  db.registerHandlers();
  db.prepareSettingsStatements();
  db.registerSettingsHandlers();
  meet.registerMeetHandlers();
  meet.setupDatabase(db._stmts);
  consistency.registerHandlers();
  generator.registerHandlers();
  log.info('Database ready');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  db.closeDatabase();
});

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err);
  app.exit(1);
});

process.on('unhandledRejection', (err) => {
  log.error('Unhandled rejection:', err);
});
