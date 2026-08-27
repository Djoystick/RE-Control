import re
with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

vote_tick_old = r"""  votingManager.on('vote:tick', (state) => {"""
vote_tick_new = r"""  votingManager.on('vote:combo', (option) => {
    mainWindow.webContents.send('simulator:syslog', { message: `🔥 MEGA COMBO! Опция [${option.id}] усилена! 🔥` })
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `💥 COMBO x5! Опция [${option.id}] усилена до MEGA-версии!`);
    }
  })

  votingManager.on('vote:tick', (state) => {"""
text = text.replace(vote_tick_old, vote_tick_new)

# Add IPC handler for simulator:combo
ipc_stop_old = r"""    ipcMain.on('simulator:stop', () => {"""
ipc_stop_new = r"""    ipcMain.on('simulator:combo', (_, optionId) => {
      // Force 5 consecutive votes
      for(let i=0; i<5; i++) {
        votingManager.handleCommand(`ComboBot_${i}`, optionId.toString());
      }
    })
    
    ipcMain.on('simulator:stop', () => {"""
text = text.replace(ipc_stop_old, ipc_stop_new)

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated index.ts")
