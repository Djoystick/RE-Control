import re
with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

# Add globalShortcut to electron import
text = text.replace("import { app, shell, BrowserWindow, ipcMain } from 'electron'", "import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'")

# Register hotkeys when app is ready
hotkey_code = """    createWindow()

    // --- GLOBAL HOTKEYS FOR STREAM DECK / MACRO PADS ---
    globalShortcut.register('CommandOrControl+Shift+T', () => {
      sysLogger.info('[Hotkey] Ctrl+Shift+T pressed -> Invoking Traitor');
      votingManager.invokeTraitor();
    });
    
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      sysLogger.info('[Hotkey] Ctrl+Shift+I pressed -> Forcing Umbrella Intervention');
      (votingManager as any).rollIntervention(true);
    });"""

text = text.replace("    createWindow()", hotkey_code, 1)

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
