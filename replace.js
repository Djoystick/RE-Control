const fs = require('fs');
let c = fs.readFileSync('H:/Work/RE_Control/src/main/index.ts', 'utf8');

const replacement = 
  // 3. UI Control Events
  ipcMain.on('simulator:start', () => {
    votingManager.startCycle()
  })
  
  ipcMain.on('simulator:stop', () => {
    votingManager.stop()
    simulator.stopSimulating()
    mainWindow.webContents.send('simulator:syslog', { message: 'VOTING STOPPED' })
  })

  ipcMain.on('twitch:connect', (_, channel) => {
    twitchBridge.connect(channel)
    mainWindow.webContents.send('simulator:syslog', { message: 'TWITCH CONNECTED: #' + channel })
    votingManager.startCycle()
  })

  ipcMain.on('twitch:disconnect', () => {
    twitchBridge.disconnect()
    votingManager.stop()
    mainWindow.webContents.send('simulator:syslog', { message: 'TWITCH DISCONNECTED' })
  })
;

c = c.replace(/ipcMain\.on\('simulator:start'[\s\S]*?VOTING STOPPED' \}\)\n  \}\)/, replacement.trim());
fs.writeFileSync('H:/Work/RE_Control/src/main/index.ts', c);
