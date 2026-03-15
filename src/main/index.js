import { app, BrowserWindow, shell, Menu } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerIpcHandlers } from './ipc.js'
import { initDb } from './db.js'
import { getDefaultPath, listPortfolios, addPortfolio, setDefault } from './portfolios.js'

function buildMenu(win) {
  const isMac = process.platform === 'darwin'
  const isDev = !app.isPackaged

  const template = [
    // macOS app menu
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        // Dev tools only in development
        ...(isDev ? [
          { type: 'separator' },
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' }
        ] : [])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  // Also block F12 / Ctrl+Shift+I in production
  if (!isDev) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.key === 'F12' ||
          (input.control && input.shift && input.key === 'I') ||
          (input.meta    && input.alt   && input.key === 'I')) {
        _e.preventDefault()
      }
    })
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.NODE_ENV === 'development') {
    console.log('[main] loading renderer URL:', process.env.ELECTRON_RENDERER_URL)
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  buildMenu(win)
}

app.whenReady().then(async () => {
  registerIpcHandlers()

  // One-time migration: if no portfolios registered but old default DB exists, adopt it
  const { portfolios } = listPortfolios()
  if (portfolios.length === 0) {
    const legacyPath = join(app.getPath('home'), '.vinance', 'vinance.db')
    if (existsSync(legacyPath)) {
      addPortfolio({ name: 'Personal', path: legacyPath })
      setDefault(legacyPath)
    }
  }

  // Auto-open default portfolio if it exists on disk
  const defaultPath = getDefaultPath()
  if (defaultPath && existsSync(defaultPath)) {
    await initDb(defaultPath)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
