import re
with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "r", encoding="utf-8") as f:
    text = f.read()

pattern = r"(getState\(\): VoteState \{\s*const totalVotes = this\.options\.reduce\(\(sum, opt\) => sum \+ opt\.votes, 0\);\s*return \{\s*isActive: this\.isActive,\s*options: this\.options,\s*timeRemainingMs: this\.timeRemainingMs,\s*totalVotes)\s*\};\s*\}"

replacement = r"\1,\n            intervention: this.interventionState\n        };\n    }"

text = re.sub(pattern, replacement, text)

with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Patched getState")
