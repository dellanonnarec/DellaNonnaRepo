const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  getPrinters: () => ipcRenderer.invoke("desktop:get-printers"),
  printReceipt: (input) => ipcRenderer.invoke("desktop:print-receipt", input),
  testPrinter: (printerName) => ipcRenderer.invoke("desktop:test-printer", printerName),
  getStartupSetting: () => ipcRenderer.invoke("desktop:get-startup-setting"),
  setStartupSetting: (enabled) => ipcRenderer.invoke("desktop:set-startup-setting", enabled),
});
