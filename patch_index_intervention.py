import re
with open(r"H:\Work\RE_Control\src\main\index.ts", "r", encoding="utf-8") as f:
    text = f.read()

vote_combo_old = r"""  votingManager.on('vote:combo', (option) => {
    mainWindow.webContents.send('simulator:syslog', { message: `🔥 MEGA COMBO! Опция [${option.id}] усилена! 🔥` })
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `💥 COMBO x5! Опция [${option.id}] усилена до MEGA-версии!`);
    }
  })"""
vote_combo_new = r"""  votingManager.on('vote:intervention', (state) => {
    mainWindow.webContents.send('simulator:syslog', { message: state.message })
    overlayServer.broadcast('vote:intervention', state)
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `🚨 ВМЕШАТЕЛЬСТВО АМБРЕЛЛЫ: ${state.message}`);
    }
  })"""
text = text.replace(vote_combo_old, vote_combo_new)

ipc_combo_old = r"""  ipcMain.on('simulator:combo', (_, optionId) => {
    for(let i=0; i<5; i++) {
      votingManager.handleChatCommand({ username: `ComboBot_${i}`, command: optionId.toString(), args: [] });
    }
  })"""
ipc_combo_new = r"""  ipcMain.on('simulator:combo', () => {
    // We repurpose the combo button to force an intervention instantly
    (votingManager as any).rollIntervention();
  })"""
text = text.replace(ipc_combo_old, ipc_combo_new)

with open(r"H:\Work\RE_Control\src\main\index.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated index.ts")
