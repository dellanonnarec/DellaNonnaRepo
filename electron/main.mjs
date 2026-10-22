import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReceipt58mm } from "../printing-agent/src/receipt.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
let mainWindow;
let launchAtLogin = false;

function getPrintScriptPath() {
  return app.isPackaged
    ? resolve(process.resourcesPath, "printing", "print-raw.ps1")
    : resolve(here, "..", "printing-agent", "src", "print-raw.ps1");
}

async function listPrinters() {
  if (!mainWindow) return [];
  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers.map(({ name, displayName, status }) => ({ name, displayName, status }));
}

async function printRaw(printerName, bytes) {
  if (process.platform !== "win32") throw new Error("A impressão ESC/POS está disponível no Windows.");
  const printers = await listPrinters();
  if (!printers.some((printer) => printer.name === printerName)) {
    throw new Error("A impressora selecionada não está instalada no Windows.");
  }

  const script = getPrintScriptPath();
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || `O spooler do Windows retornou código ${code}.`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout.trim()));
      } catch {
        rejectPromise(new Error("O spooler não confirmou o trabalho de impressão."));
      }
    });
    child.stdin.end(JSON.stringify({ printerName, data: bytes.toString("base64") }), "utf8");
  });
}

function registerIpc() {
  ipcMain.handle("desktop:get-printers", () => listPrinters());
  ipcMain.handle("desktop:print-receipt", async (_event, input) => {
    if (!input || typeof input.printerName !== "string" || !input.order || typeof input.order !== "object") {
      throw new Error("Dados do ticket inválidos.");
    }
    return printRaw(input.printerName, createReceipt58mm(input.order));
  });
  ipcMain.handle("desktop:test-printer", async (_event, printerName) => {
    if (typeof printerName !== "string") throw new Error("Selecione uma impressora.");
    const ESC = 0x1b;
    const bytes = Buffer.from([ESC, 0x40, ESC, 0x61, 0x01, ...Buffer.from("DELLA NONNA\nTESTE DE IMPRESSAO\n58 mm\n\n", "ascii"), ESC, 0x61, 0x00, 0x0a]);
    return printRaw(printerName, bytes);
  });
  ipcMain.handle("desktop:get-startup-setting", () => launchAtLogin);
  ipcMain.handle("desktop:set-startup-setting", (_event, enabled) => {
    launchAtLogin = Boolean(enabled);
    app.setLoginItemSettings({ openAtLogin: launchAtLogin, args: ["--desktop"] });
    return launchAtLogin;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 920,
    minHeight: 650,
    backgroundColor: "#f7f5f0",
    title: "Della Nonna · Central de pedidos",
    webPreferences: {
      preload: resolve(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173/#/admin/impressao");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(resolve(here, "..", "dist", "index.html"), { hash: "/admin/impressao" });
  }
  mainWindow.on("closed", () => { mainWindow = undefined; });
}

app.whenReady().then(() => {
  registerIpc();
  app.setAppUserModelId("br.com.dellanonna.pedidos");
  launchAtLogin = app.getLoginItemSettings().openAtLogin;
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
