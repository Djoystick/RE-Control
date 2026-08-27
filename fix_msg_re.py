import re
with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

pattern = r"const numToEmoji = \['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'\];\s*const optionsText = state\.options\.map\(\(opt: any\) => `\$\{numToEmoji\[opt\.id\] \|\| opt\.id\} \$\{opt\.displayName\}`\)\.join\('  🔸  '\);\s*twitchBridge\.sendMessage\(activeTwitchChannel, `📢 ГОЛОСОВАНИЕ! Пишите цифру:  🔸  \$\{optionsText\}`\);"

new_code = r"""const optionsText = state.options.map((opt: any) => `[${opt.id}] ${opt.displayName}`).join('  |  ');
      twitchBridge.sendMessage(activeTwitchChannel, `📢 ГОЛОСОВАНИЕ! Пишите цифру: ${optionsText}`);"""

text = re.sub(pattern, new_code, text)

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Done")
