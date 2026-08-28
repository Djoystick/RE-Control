import 'dotenv/config';
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ChatSimulator } from './simulator/ChatSimulator'
import { TwitchBridge } from './chat-bridge/TwitchBridge'
import { DonationBridge } from './chat-bridge/DonationBridge'
import { REBridge } from './game-bridge/REBridge'
import { VotingManager } from './game-bridge/VotingManager'
import { narrator } from './ai-narrator/Narrator'
import { sysLogger } from './utils/logger'
import { dbManager } from './db/DatabaseManager'
import { SUPPORTED_GAMES } from './setup/GameDatabase'
import { GameFinder } from './setup/GameFinder'
import { Installer } from './setup/Installer'
import fs from 'fs'
import { OverlayServer } from './overlay/OverlayServer'

const gameFinder = new GameFinder()
const installer = new Installer()

function createWindow(): void {
  // Initialize Database
  dbManager.init()

  const mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Expose DB IPC
  ipcMain.handle('db:getLeaderboard', () => {
    return dbManager.getTopKarma(5);
  });

  ipcMain.handle('settings:saveTwitchAuth', (_, { username, token, channel }) => {
    const configPath = join(app.getPath('userData'), 'twitch_config.json')
    fs.writeFileSync(configPath, JSON.stringify({ username, token, channel }))
  })

  ipcMain.handle('settings:getTwitchAuth', () => {
    const configPath = join(app.getPath('userData'), 'twitch_config.json')
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'))
    }
    return null
  })

  // Setup Wizard IPC
  ipcMain.handle('setup:getGames', () => SUPPORTED_GAMES);

  ipcMain.handle('setup:findGame', (_, { steamAppId, exeName }: { steamAppId: string; exeName: string }) => {
    return gameFinder.findGame(steamAppId, exeName);
  });

  ipcMain.handle('setup:browseExe', () => gameFinder.browseForGame());

  ipcMain.handle('setup:install', async (_, { gamePath, archiveName }: { gamePath: string; archiveName: string }) => {
    await installer.install({
      gamePath,
      archiveName,
      onProgress: (percent, message) => {
        mainWindow.webContents.send('install:progress', { percent, message });
      }
    });
    
    const configPath = join(app.getPath('userData'), 'game_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ gamePath }));
  });

  ipcMain.handle('setup:saveGamePath', (_, gamePath: string) => {
    const configPath = join(app.getPath('userData'), 'game_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ gamePath }));
  });

  ipcMain.handle('setup:getStoredGamePath', () => {
    const configPath = join(app.getPath('userData'), 'game_config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return data.gamePath || null;
    }
    return null;
  });

  ipcMain.handle('setup:updateScripts', async (_, { gamePath }: { gamePath: string }) => {
    await installer.updateScripts(gamePath, (percent, message) => {
      mainWindow.webContents.send('install:progress', { percent, message });
    });
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Setup services
  const simulator = new ChatSimulator()
  const twitchBridge = new TwitchBridge()
  const gameBridge = new REBridge()
  const votingManager = new VotingManager()
  const overlayServer = new OverlayServer()
  const donationBridge = new DonationBridge()

  donationBridge.on('donation:received', ({ amount }) => {
    mainWindow.webContents.send('simulator:syslog', { message: 'DONATION RECEIVED: ' + amount })
    votingManager.handleDonation(amount)
  })

  // 1. Sim Chat messages route to VotingManager
  simulator.onCommand((cmd) => {
    votingManager.handleChatCommand(cmd)
    mainWindow.webContents.send('simulator:log', cmd)
  })

  // 1b. Twitch Chat messages route to VotingManager
  twitchBridge.onCommand((cmd) => {
    votingManager.handleChatCommand(cmd)
    mainWindow.webContents.send('simulator:log', cmd)
    overlayServer.broadcast('chat:message', cmd)
  })

  let activeTwitchChannel = '';

  // 2. Voting Manager Events route to UI and Game Bridge
  votingManager.on('vote:interrupted', () => {
    mainWindow.webContents.send('simulator:syslog', { message: 'VOTE INTERRUPTED BY VIP DONATION!' })
  })

  votingManager.on('vote:start', (state) => {
    if (!activeTwitchChannel) simulator.startSimulating(500)
    mainWindow.webContents.send('vote:update', state)
    mainWindow.webContents.send('simulator:syslog', { message: 'VOTING STARTED!' })
    overlayServer.broadcast('vote:start', state)
    overlayServer.broadcast('vote:update', state)

    if (activeTwitchChannel) {
      const optionsText = state.options.map((opt: any) => `[${opt.id}] ${opt.displayName}`).join('  |  ');
      twitchBridge.sendMessage(activeTwitchChannel, `📢 ГОЛОСОВАНИЕ! Пишите цифру: ${optionsText}`);
    }
  })

  votingManager.on('vote:intervention', (state) => {
    mainWindow.webContents.send('simulator:syslog', { message: state.message })
    overlayServer.broadcast('vote:intervention', state)
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `🚨 ВМЕШАТЕЛЬСТВО АМБРЕЛЛЫ: ${state.message}`);
    }
  })

  // Narrator: intervention events
  votingManager.on('vote:intervention', (state) => {
    narrator.say(state.type)
  })

  // Narrator: traitor starts
  votingManager.on('traitor:start', () => {
    narrator.say('traitor')
  })

  // Narrator: effect wins
  votingManager.on('vote:end', ({ winner }) => {
    if (!winner) return;
    if (winner.category === 'negative') {
      narrator.say('negative_win')
    } else if (winner.category === 'positive') {
      narrator.say('positive_win')
    }
  })

  narrator.on('narrator:speak', (data) => {
    overlayServer.broadcast('narrator:speak', data)
    mainWindow.webContents.send('narrator:speak', data)
  })

  narrator.on('narrator:audio', (data) => {
    overlayServer.broadcast('narrator:audio', data)
  })

  ipcMain.on('narrator:toggle', (_, val: boolean) => {
    narrator.setEnabled(val)
  })

  votingManager.on('vote:tick', (state) => {
    mainWindow.webContents.send('vote:update', state)
    overlayServer.broadcast('vote:update', state)
  })

  votingManager.on('vote:update', (state) => {
    mainWindow.webContents.send('vote:update', state)
    overlayServer.broadcast('vote:update', state)
  })

  votingManager.on('vote:end', ({ winner, state }) => {
    simulator.stopSimulating()
    mainWindow.webContents.send('vote:update', state)
    mainWindow.webContents.send('simulator:syslog', { message: 'WINNER: ' + winner.displayName })
    overlayServer.broadcast('vote:end', { winner, state })
    // Emit effect:start since REBridge doesn't tell us when it really starts. 
    // We assume it starts immediately after voting. 10000ms is a placeholder.
    overlayServer.broadcast('effect:start', { effect: winner.displayName, duration: 10000 })
    setTimeout(() => {
        overlayServer.broadcast('effect:end', { effect: winner.displayName })
    }, 10000)
    
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `🏆 ГОЛОСОВАНИЕ ЗАВЕРШЕНО! Эффект [ ${winner.displayName} ] победил (${winner.votes} голосов)!`);
    }

    // Send effect to the game
    gameBridge.sendCommand(winner.effectId).catch((err) => { console.warn('Bridge timeout (Game Offline):', err.message); mainWindow.webContents.send('simulator:syslog', { message: 'GAME OFFLINE: Effect not executed.' }); })
  })

  votingManager.on('trusted:count', (count) => {
    mainWindow.webContents.send('trusted:count', count)
  })

  votingManager.on('traitor:start', (state) => {
    simulator.stopSimulating()
    mainWindow.webContents.send('traitor:start', state)
    mainWindow.webContents.send('simulator:syslog', { message: `TRAITOR MODE STARTED! Traitor: ${state.username}` })
    overlayServer.broadcast('traitor:start', state)
    
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `🚨 ВНИМАНИЕ! 💀 ПРЕДАТЕЛЬ @${state.username} ЗАХВАТИЛ УПРАВЛЕНИЕ! 💀`);
    }
  })

  votingManager.on('traitor:end', (state) => {
    mainWindow.webContents.send('traitor:end', state)
    mainWindow.webContents.send('simulator:syslog', { message: `TRAITOR MODE ENDED!` })
  })

  votingManager.on('traitor:effect', (effectId) => {
    gameBridge.sendCommand(effectId).catch((err) => { 
        console.warn('Bridge timeout (Game Offline):', err.message); 
        mainWindow.webContents.send('simulator:syslog', { message: 'GAME OFFLINE: Effect not executed.' }); 
    })
  })

  votingManager.on('vip:effect', (effectId) => {
    gameBridge.sendCommand(effectId).catch((err) => { 
        console.warn('Bridge timeout (Game Offline):', err.message); 
        mainWindow.webContents.send('simulator:syslog', { message: 'GAME OFFLINE: Effect not executed.' }); 
    })
  })

  // 3. UI Control Events
  ipcMain.on('simulator:start', () => {
    votingManager.startCycle()
  })
  ipcMain.on('simulator:combo', () => {
    // We repurpose the combo button to force an intervention instantly
    (votingManager as any).rollIntervention(true);
  })

  ipcMain.on('simulator:stop', () => {
    votingManager.stop()
    simulator.stopSimulating()
    mainWindow.webContents.send('simulator:syslog', { message: 'VOTING STOPPED' })
    const emptyState = { isActive: false, options: [], timeRemainingMs: 0, totalVotes: 0 };
    mainWindow.webContents.send('vote:update', emptyState)
    overlayServer.broadcast('vote:update', emptyState)
  })

  
  // ─── AUDIO TESTER IPC ───
  ipcMain.handle('audio:get-files', () => {
    const base = join(process.cwd(), 'assets', 'audio')
    const result: Record<string, string[]> = {}
    if (fs.existsSync(base)) {
      const folders = fs.readdirSync(base)
      for (const f of folders) {
        const folderPath = join(base, f)
        if (fs.statSync(folderPath).isDirectory()) {
          result[f] = fs.readdirSync(folderPath).filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg'))
        }
      }
    }
    return result
  })

  ipcMain.handle('audio:read-file', (_, folder: string, file: string) => {
    const filePath = join(process.cwd(), 'assets', 'audio', folder, file)
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath)
      return buffer.toString('base64')
    }
    return null
  })

  
  ipcMain.handle('simulator:force-narrator', (_, type: string) => {
    narrator.say(type)
  })

  ipcMain.handle('simulator:invokeTraitor', () => {
    return votingManager.invokeTraitor()
  })

  ipcMain.on('simulator:donate', (_, amount) => {
    donationBridge.simulateDonation("Test_Donator", amount, "RUB", "За императора!")
  })

  ipcMain.handle('game:launch', () => {
    const configPath = join(app.getPath('userData'), 'game_config.json');
    if (fs.existsSync(configPath)) {
      try {
        const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (conf.gamePath) {
          sysLogger.info(`[Game] Launching: ${conf.gamePath}`);
          execFile(conf.gamePath, [], { cwd: require('path').dirname(conf.gamePath) }, (error) => {
            if (error) sysLogger.error(`[Game Launch Error]: ${error.message}`);
          });
          return true;
        }
      } catch (e) {
        sysLogger.error(`[Game Launch Error]: ${e}`);
        return false;
      }
    }
    return false;
  });

  ipcMain.on('window:close', () => mainWindow.close())
  ipcMain.on('window:minimize', () => mainWindow.minimize())

  ipcMain.on('twitch:connect', (_, channelInput) => {
    let channel = channelInput.trim();
    if (channel.includes('twitch.tv/')) {
        channel = channel.split('twitch.tv/')[1].split('/')[0].split('?')[0];
    }
    channel = channel.replace('@', '').toLowerCase();

    sysLogger.info('Connecting to Twitch channel: ' + channel);
    twitchBridge.connect(channel).then(() => {
        activeTwitchChannel = channel;
        sysLogger.info('Twitch connection successful.');
        mainWindow.webContents.send('simulator:syslog', { message: 'TWITCH CONNECTED: #' + channel })
        mainWindow.webContents.send('twitch:status', { connected: true, channel, botAuthenticated: twitchBridge.isBotAuthenticated })
        overlayServer.broadcast('twitch:connected', { channel })
    }).catch(err => {
        sysLogger.error('Twitch connection failed', err);
        mainWindow.webContents.send('simulator:syslog', { message: 'TWITCH CONNECTION FAILED!' })
        mainWindow.webContents.send('twitch:status', { connected: false, channel: '', botAuthenticated: false })
    });
  })

  ipcMain.on('twitch:disconnect', () => {
    activeTwitchChannel = '';
    twitchBridge.disconnect()
    votingManager.stop()
    mainWindow.webContents.send('simulator:syslog', { message: 'TWITCH DISCONNECTED' })
    mainWindow.webContents.send('twitch:status', { connected: false, channel: '', botAuthenticated: false })
    overlayServer.broadcast('twitch:disconnected', {})
  })

  ipcMain.handle('twitch:validateToken', async (_, token: string) => {
    try {
      const cleanToken = token.startsWith('oauth:') ? token.slice(6) : token;
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `OAuth ${cleanToken}`
        }
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  })

  ipcMain.on('settings:update', (_, settings) => {
    if (settings.cooldownMs) {
      votingManager.setCooldown(settings.cooldownMs)
      mainWindow.webContents.send('simulator:syslog', { message: 'PACING UPDATED: Cooldown set to ' + (settings.cooldownMs / 1000) + 's' })
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})



















