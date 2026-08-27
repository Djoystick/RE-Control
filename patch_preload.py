import re
with open(r"H:\Work\RE_Control\src\preload\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("simulatorStop: () => ipcRenderer.send('simulator:stop'),", "simulatorStop: () => ipcRenderer.send('simulator:stop'),\n  simulatorCombo: (optionId: number) => ipcRenderer.send('simulator:combo', optionId),")

with open(r"H:\Work\RE_Control\src\preload\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated Preload")
