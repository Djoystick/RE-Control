import re
with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

old_code = r"""      if (activeTwitchChannel) {
        const numToEmoji = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        const optionsText = state.options.map((opt: any) => `${numToEmoji[opt.id] || opt.id} ${opt.displayName}`).join('  🔸  ');
        twitchBridge.sendMessage(activeTwitchChannel, `📢 ГОЛОСОВАНИЕ! Пишите цифру:  🔸  ${optionsText}`);
      }"""

new_code = """      if (activeTwitchChannel) {
        const optionsText = state.options.map((opt: any) => `[${opt.id}] ${opt.displayName}`).join('  |  ');
        twitchBridge.sendMessage(activeTwitchChannel, `📢 ГОЛОСОВАНИЕ! Пишите цифру: ${optionsText}`);
      }"""

text = text.replace(old_code, new_code)

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Done")
