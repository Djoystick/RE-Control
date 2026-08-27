with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Add narrator import after VotingManager import
text = text.replace(
    "import { VotingManager } from './game-bridge/VotingManager'",
    "import { VotingManager } from './game-bridge/VotingManager'\nimport { narrator } from './ai-narrator/Narrator'"
)

# 2. Wire narrator events after vote:intervention handler
old_wire = "  votingManager.on('vote:tick', (state) => {"
new_wire = """  // Narrator: intervention events
  votingManager.on('vote:intervention', (state) => {
    narrator.say(state.type)
  })

  // Narrator: traitor starts
  votingManager.on('traitor:start', (state) => {
    narrator.say('traitor', state.username)
  })

  // Narrator: negative effect wins
  votingManager.on('vote:end', ({ winner }) => {
    if (winner && winner.category === 'negative') {
      narrator.say('negative_win')
    }
  })

  narrator.on('narrator:speak', (data) => {
    overlayServer.broadcast('narrator:speak', data)
    mainWindow.webContents.send('narrator:speak', data)
  })

  ipcMain.on('narrator:toggle', (_, val: boolean) => {
    narrator.setEnabled(val)
  })

  votingManager.on('vote:tick', (state) => {"""

text = text.replace(old_wire, new_wire)

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("index.ts wired")
