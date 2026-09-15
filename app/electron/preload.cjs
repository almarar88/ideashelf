// Exposes a minimal, typed bridge to the renderer. Every call goes through the
// user's Control settings in the app before reaching here.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("majlisDesktop", {
  platform: process.platform,
  invoke: (name, input) => ipcRenderer.invoke("majlis:tool", { name, input: input ?? {} }),
});
