import re
with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

ipc_logic = """
  // --- HOTKEYS IPC ---
  const HOTKEYS_FILE = join(app.getPath('userData'), 'hotkeys_config.json');
  
  const defaultHotkeys = {
    traitor: 'CommandOrControl+Shift+T',
    intervention: 'CommandOrControl+Shift+I'
  };

  function getHotkeys() {
    if (fs.existsSync(HOTKEYS_FILE)) {
      try { return JSON.parse(fs.readFileSync(HOTKEYS_FILE, 'utf8')); } catch (e) {}
    }
    return defaultHotkeys;
  }

  function registerGlobalHotkeys() {
    globalShortcut.unregisterAll();
    const h = getHotkeys();
    
    if (h.traitor) {
      globalShortcut.register(h.traitor, () => {
        sysLogger.info(`[Hotkey] ${h.traitor} pressed -> Invoking Traitor`);
        votingManager.invokeTraitor();
      });
    }
    if (h.intervention) {
      globalShortcut.register(h.intervention, () => {
        sysLogger.info(`[Hotkey] ${h.intervention} pressed -> Forcing Umbrella Intervention`);
        (votingManager as any).rollIntervention(true);
      });
    }
  }

  ipcMain.handle('settings:getHotkeys', () => getHotkeys());
  
  ipcMain.handle('settings:saveHotkeys', (_, hotkeys) => {
    fs.writeFileSync(HOTKEYS_FILE, JSON.stringify(hotkeys));
    registerGlobalHotkeys(); // re-register on the fly
    return true;
  });

  // Expose DB IPC"""

text = text.replace("  // Expose DB IPC", ipc_logic)

# Replace the hardcoded hotkey block with the dynamic one
hardcoded_hotkeys = """    // --- GLOBAL HOTKEYS FOR STREAM DECK / MACRO PADS ---
    globalShortcut.register('CommandOrControl+Shift+T', () => {
      sysLogger.info('[Hotkey] Ctrl+Shift+T pressed -> Invoking Traitor');
      votingManager.invokeTraitor();
    });
    
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      sysLogger.info('[Hotkey] Ctrl+Shift+I pressed -> Forcing Umbrella Intervention');
      (votingManager as any).rollIntervention(true);
    });"""

text = text.replace(hardcoded_hotkeys, "    registerGlobalHotkeys();")

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
