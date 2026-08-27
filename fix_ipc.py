import re
with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("votingManager.handleCommand(`ComboBot_${i}`, optionId.toString());", "votingManager.handleChatCommand({ username: `ComboBot_${i}`, command: optionId.toString(), args: [] });")

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Fixed ipc handler")
