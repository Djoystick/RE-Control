with open(r"H:\Work\RE_Control\src\preload\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("launchGame: () => ipcRenderer.invoke('game:launch')", "launchGame: () => ipcRenderer.invoke('game:launch'),\n  getHotkeys: () => ipcRenderer.invoke('settings:getHotkeys'),\n  saveHotkeys: (hotkeys: any) => ipcRenderer.invoke('settings:saveHotkeys', hotkeys)")

with open(r"H:\Work\RE_Control\src\preload\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
