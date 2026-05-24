/**
 * Electron main process - Genius Computer Education Desktop App
 * Spawns Express server as a child process and loads it in a BrowserWindow.
 */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

let mainWindow = null;
let serverProcess = null;
let serverPort = null;

// Find a free port to avoid conflicts with anything running on 3000
function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
    });
}

function getServerPath() {
    // In dev: __dirname is project root
    // In packaged app (asar:false): server.js sits next to electron.js inside resources/app/
    return path.join(__dirname, 'server.js');
}

function getAppCwd() {
    // server.js uses __dirname-relative paths for data/, uploads/, public/
    // In packaged app these live in resources/app/ alongside server.js
    return path.dirname(getServerPath());
}

function ensureDir(dir) {
    try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
}

function bootstrapDirs() {
    // When packaged, app folder may be read-only on some setups; create writable dirs alongside.
    const appCwd = getAppCwd();
    const dirs = [
        path.join(appCwd, 'uploads'),
        path.join(appCwd, 'uploads', 'logo'),
        path.join(appCwd, 'uploads', 'students'),
        path.join(appCwd, 'uploads', 'students', 'photos'),
        path.join(appCwd, 'uploads', 'video-resources'),
        path.join(appCwd, 'backups'),
        path.join(appCwd, 'data'),
    ];
    dirs.forEach(ensureDir);
}

async function startServer() {
    console.log('[electron] Starting server...');
    console.log('[electron] Server path:', getServerPath());
    console.log('[electron] Working directory:', getAppCwd());
    bootstrapDirs();
    const port = await getFreePort();
    serverPort = port;
    console.log('[electron] Allocated port:', port);

    const env = {
        ...process.env,
        PORT: String(port),
        ELECTRON_RUN: '1',
    };

    serverProcess = fork(getServerPath(), [], {
        cwd: getAppCwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    console.log('[electron] Server process forked, PID:', serverProcess.pid);

    serverProcess.stdout && serverProcess.stdout.on('data', (d) => {
        console.log('[server]', d.toString().trim());
    });
    serverProcess.stderr && serverProcess.stderr.on('data', (d) => {
        console.error('[server-err]', d.toString().trim());
    });

    serverProcess.on('exit', (code, signal) => {
        console.log(`[server] exited code=${code} signal=${signal}`);
        serverProcess = null;
    });

    // Wait for server-ready message (max 30s)
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Server failed to start within 30 seconds'));
        }, 30000);

        serverProcess.on('message', (msg) => {
            if (msg && msg.type === 'server-ready') {
                clearTimeout(timeout);
                resolve(msg.port);
            }
        });

        serverProcess.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'Genius Computer Education',
        icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
        show: false,
        backgroundColor: '#1a1a2e',
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.loadURL(`http://localhost:${serverPort}/`);

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://localhost') || url.startsWith(`http://127.0.0.1`)) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function buildMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        }] : []),
        {
            label: 'File',
            submenu: [
                isMac ? { role: 'close' } : { role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                ] : [
                    { role: 'close' },
                ]),
            ],
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Visit Website',
                    click: () => shell.openExternal('https://geniuscomputereducation.com'),
                },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
    try {
        buildMenu();
        await startServer();
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    } catch (err) {
        console.error('Failed to start app:', err);
        dialog.showErrorBox('Startup Error', `Failed to start Genius Computer Education:\n\n${err.message}`);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        try { serverProcess.kill(); } catch (_) {}
        serverProcess = null;
    }
});
