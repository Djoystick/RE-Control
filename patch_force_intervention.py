import re
with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("private rollIntervention() {", "private rollIntervention(force: boolean = false) {")
text = text.replace("if (Math.random() > 0.3) {", "if (!force && Math.random() > 0.3) {")

with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Added force param")

with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text2 = f.read()
text2 = text2.replace("(votingManager as any).rollIntervention();", "(votingManager as any).rollIntervention(true);")
with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text2)
print("Updated IPC")
