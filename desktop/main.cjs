const { app, BrowserWindow, Menu } = require('electron');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const isDev = process.env.ZRA_BRUP_DEV === '1';
let backend;
let shuttingDown = false;

function waitForPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const check = () => {
      const socket = net.createConnection({ port, host });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => { socket.destroy(); setTimeout(check, 250); });
    };
    check();
  });
}

function startServices() {
  if (isDev) {
    backend = spawn('npm', ['run', 'dev'], { cwd: projectRoot, shell: true, stdio: 'inherit' });
  } else {
    backend = spawn(process.execPath, [path.join(projectRoot, 'server.mjs')], { cwd: projectRoot, stdio: 'inherit' });
  }
}

function stopServices() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (backend && !backend.killed) {
    backend.kill('SIGTERM');
    setTimeout(() => { if (backend && !backend.killed) backend.kill('SIGKILL'); }, 1500).unref();
  }
}

async function createWindow() {
  startServices();
  await waitForPort(isDev ? 5173 : 4173);
  Menu.setApplicationMenu(null);
  const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 1000, minHeight: 650, autoHideMenuBar: true, backgroundColor: '#f7f9fa', webPreferences: { contextIsolation: true, nodeIntegration: false } });
  await window.loadURL(isDev ? 'http://127.0.0.1:5173' : `file://${path.join(projectRoot, 'dist/index.html')}`);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { stopServices(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', stopServices);
