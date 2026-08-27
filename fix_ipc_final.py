import re
with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

pattern = r"\s*ipcMain\.on\('simulator:stop', \(\) => \{"
replacement = r"""
  ipcMain.on('simulator:combo', (_, optionId) => {
    for(let i=0; i<5; i++) {
      votingManager.handleChatCommand({ username: `ComboBot_${i}`, command: optionId.toString(), args: [] });
    }
  })

  ipcMain.on('simulator:stop', () => {"""

text = re.sub(pattern, replacement, text)

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Fixed IPC Combo listener!")
