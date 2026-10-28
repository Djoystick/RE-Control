import 'dotenv/config';
import { app, shell, BrowserWindow, ipcMain, globalShortcut, safeStorage } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ChatSimulator } from './simulator/ChatSimulator'
import { TwitchBridge } from './chat-bridge/TwitchBridge'
import { DonationBridge } from './chat-bridge/DonationBridge'
import { REBridge } from './game-bridge/REBridge'
import { VotingManager } from './game-bridge/VotingManager'
import { sessionStore } from './game-bridge/SessionStore'
import { obsMarkerService } from './integrations/ObsMarkerService'
import { narrator, getAudioBasePath, getAllLines } from './ai-narrator/Narrator'
import { ttsService } from './ai-narrator/TTSService'
import { sysLogger } from './utils/logger'
import { dbManager } from './db/DatabaseManager'
import { SUPPORTED_GAMES } from './setup/GameDatabase'
import { GameFinder } from './setup/GameFinder'
import { Installer } from './setup/Installer'
import fs from 'fs'
import { OverlayServer } from './overlay/OverlayServer'
import { VOTABLE_EFFECTS } from '../shared/effects-registry'
import { GAME_PROFILES, resolveProfile } from '../shared/game-profiles'

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


  // --- HOTKEYS IPC ---
  const HOTKEYS_FILE = join(app.getPath('userData'), 'hotkeys_config.json');
  
  const defaultHotkeys = {
    traitor: 'CommandOrControl+Shift+T',
    intervention: 'CommandOrControl+Shift+I',
    panic: 'CommandOrControl+Shift+P'
  };

  function getHotkeys() {
    if (fs.existsSync(HOTKEYS_FILE)) {
      try { return JSON.parse(fs.readFileSync(HOTKEYS_FILE, 'utf8')); } catch (e) {}
    }
    return defaultHotkeys;
  }

  function registerGlobalHotkeys() {
    globalShortcut.unregisterAll();
    const h = getHotkeys();

    if (h.traitor) {
      globalShortcut.register(h.traitor, () => {
        sysLogger.info(`[Hotkey] ${h.traitor} pressed -> Invoking Traitor`);
        votingManager.invokeTraitor();
      });
    }
    if (h.intervention) {
      globalShortcut.register(h.intervention, () => {
        sysLogger.info(`[Hotkey] ${h.intervention} pressed -> Forcing Umbrella Intervention`);
        (votingManager as any).rollIntervention(true);
      });
    }
    if (h.panic) {
      globalShortcut.register(h.panic, () => {
        sysLogger.warn(`[Hotkey] ${h.panic} pressed -> PANIC STOP`);
        panicStop();
      });
    }
  }

  function panicStop() {
    votingManager.panicStop();
    // Reset every active timed effect inside the game (time scale, FOV, blackout, ...)
    gameBridge.sendCommand('reset_all').catch((err) => {
      sysLogger.warn(`[Panic] Game reset_all failed (game offline?): ${err.message}`);
    });
    overlayServer.broadcast('effect:end', {});
    overlayServer.broadcast('vote:update', { isActive: false, options: [], timeRemainingMs: 0, totalVotes: 0 });
    mainWindow.webContents.send('simulator:syslog', { message: 'PANIC STOP: все эффекты сброшены, автопилот остановлен.' });
    narrator.say('panic');
    obsMarkerService.mark('PANIC STOP').catch(() => {});
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, '☣️ [UMBRELLA CORP] ⏸ АВАРИЙНАЯ ОСТАНОВКА. Все активные протоколы деактивированы.');
    }
  }

  ipcMain.handle('settings:getHotkeys', () => getHotkeys());
  
  ipcMain.handle('settings:saveHotkeys', (_, hotkeys) => {
    fs.writeFileSync(HOTKEYS_FILE, JSON.stringify(hotkeys));
    registerGlobalHotkeys(); // re-register on the fly
    return true;
  });

  registerGlobalHotkeys();

  // --- DIRECTOR IPC (adaptive pacing config) ---
  const DIRECTOR_CONFIG_FILE = join(app.getPath('userData'), 'director_config.json');

  function loadDirectorConfig() {
    if (fs.existsSync(DIRECTOR_CONFIG_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(DIRECTOR_CONFIG_FILE, 'utf8'));
        votingManager.setDirectorConfig(saved);
        sysLogger.info('[Director] Loaded saved config:', saved);
      } catch (e) {
        sysLogger.error('Failed to read director config: ' + e);
      }
    }
  }

  ipcMain.handle('settings:getDirector', () => votingManager.getDirectorConfig());
  ipcMain.handle('settings:saveDirector', (_, config) => {
    votingManager.setDirectorConfig(config);
    fs.writeFileSync(DIRECTOR_CONFIG_FILE, JSON.stringify(votingManager.getDirectorConfig(), null, 2));
    return votingManager.getDirectorConfig();
  });

  // --- AUDIO VOLUME IPC ---
  const AUDIO_CONFIG_FILE = join(app.getPath('userData'), 'audio_config.json');

  function getAudioVolume(): number {
    if (fs.existsSync(AUDIO_CONFIG_FILE)) {
      try {
        const conf = JSON.parse(fs.readFileSync(AUDIO_CONFIG_FILE, 'utf8'));
        if (typeof conf.volume === 'number') return conf.volume;
      } catch (e) {}
    }
    return 80;
  }

  narrator.setVolume(getAudioVolume() / 100);

  ipcMain.handle('settings:getVolume', () => getAudioVolume());

  // Expose DB IPC
  ipcMain.handle('db:getLeaderboard', () => {
    return dbManager.getTopKarma(5);
  });

  ipcMain.handle('db:getSessionReport', () => {
    return votingManager.getSessionReport();
  });

  ipcMain.handle('db:publishReport', () => {
    const report = votingManager.getSessionReport();
    const text = report.text;
    mainWindow.webContents.send('simulator:syslog', { message: text });
    overlayServer.broadcast('report:session', report);
    if (activeTwitchChannel) twitchBridge.sendMessage(activeTwitchChannel, text);
    return report;
  });

  ipcMain.handle('settings:saveTwitchAuth', (_, { username, token, channel }) => {
    const configPath = join(app.getPath('userData'), 'twitch_config.json')
    let existing: any = {}
    if (fs.existsSync(configPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      } catch {}
    }

    const payload: any = {
      username: username ?? existing.username ?? '',
      channel: channel ?? existing.channel ?? ''
    }

    if (token && typeof token === 'string' && !token.includes('••••')) {
      if (safeStorage.isEncryptionAvailable()) {
        payload.encryptedToken = safeStorage.encryptString(token).toString('base64')
        payload.isEncrypted = true
      } else {
        sysLogger.error('safeStorage is not available. Refusing to store OAuth token in plaintext!')
        return { success: false, error: 'Безопасное хранилище (safeStorage) недоступно. Сохранение токена в открытом виде заблокировано для безопасности.' }
      }
    } else if (existing.encryptedToken) {
      payload.encryptedToken = existing.encryptedToken
      payload.isEncrypted = existing.isEncrypted
    }

    fs.writeFileSync(configPath, JSON.stringify(payload, null, 2))
    return { success: true }
  })

  ipcMain.handle('settings:getTwitchAuth', () => {
    const configPath = join(app.getPath('userData'), 'twitch_config.json')
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        const hasToken = !!(raw.encryptedToken || raw.token)
        return {
          username: raw.username || '',
          channel: raw.channel || '',
          hasToken,
          maskedToken: hasToken ? '••••••••••••••••' : ''
        }
      } catch (e) {
        sysLogger.error('Failed to read twitch auth config: ' + e)
        return null
      }
    }
    return null
  })

  // Setup Wizard IPC
  ipcMain.handle('setup:getGames', () => SUPPORTED_GAMES);

  ipcMain.handle('setup:findGame', (_, { steamAppId, exeName }: { steamAppId: string; exeName: string }) => {
    return gameFinder.findGame(steamAppId, exeName);
  });

  ipcMain.handle('setup:browseExe', () => gameFinder.browseForGame());

  ipcMain.handle('setup:install', async (_, { gamePath, archiveName, gameId }: { gamePath: string; archiveName: string; gameId?: string }) => {
    await installer.install({
      gamePath,
      archiveName,
      onProgress: (percent, message) => {
        mainWindow.webContents.send('install:progress', { percent, message });
      }
    });

    const profile = resolveProfile(gameId ?? 'RE2');
    votingManager.setGameProfile(profile);
    overlayServer.setGameProfile(profile);

    const configPath = join(app.getPath('userData'), 'game_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ gamePath, gameId: gameId ?? 'RE2', profile }));
  });

  ipcMain.handle('setup:getGameProfile', () => ({
    profile: votingManager.getGameProfile(),
    ...GAME_PROFILES[votingManager.getGameProfile()]
  }));

  // Demo mode: no game, no REFramework — simulator only
  ipcMain.handle('setup:startDemo', () => {
    const configPath = join(app.getPath('userData'), 'game_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ demo: true, gameId: 'RE2', profile: 're2' }));
    votingManager.setGameProfile('re2');
    overlayServer.setGameProfile('re2');
    simulator.startSimulating(700);
    mainWindow.webContents.send('simulator:syslog', { message: 'DEMO MODE: игра не подключена, работает симулятор чата.' });
    return { demo: true };
  });

  ipcMain.handle('setup:saveGamePath', (_, gamePath: string) => {
    const configPath = join(app.getPath('userData'), 'game_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ gamePath }));
  });

  ipcMain.handle('setup:getStoredGamePath', () => {
    const configPath = join(app.getPath('userData'), 'game_config.json');
    if (fs.existsSync(configPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Restore the game profile alongside the path so pools match the installed game
        if (data.gameId) {
          const profile = resolveProfile(data.gameId);
          votingManager.setGameProfile(profile);
          overlayServer.setGameProfile(profile);
        }
        return data.gamePath || null;
      } catch {
        return null;
      }
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
    try {
      const parsed = new URL(details.url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(details.url)
      } else {
        sysLogger.warn(`[Security] Blocked attempt to open external non-http URL: ${details.url}`)
      }
    } catch {
      sysLogger.warn(`[Security] Invalid URL passed to openExternal: ${details.url}`)
    }
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

  loadDirectorConfig();

  // Restore director session statistics (round number, streaks, winners)
  votingManager.restoreSession(sessionStore.load());
  ipcMain.handle('session:reset', () => {
    votingManager.resetSession();
    mainWindow.webContents.send('simulator:syslog', { message: 'SESSION RESET: статистика Директора обнулена.' });
    return votingManager.getSessionSnapshot();
  });
  ipcMain.handle('session:get', () => votingManager.getSessionSnapshot());

  // ─── OBS MARKERS (v1.5.0) ───
  obsMarkerService.loadConfig();
  ipcMain.handle('obs:getMarkerConfig', () => obsMarkerService.getConfig());
  ipcMain.handle('obs:setMarkerConfig', (_, patch) => obsMarkerService.setConfig(patch));
  ipcMain.handle('obs:testMarker', async () => {
    const ok = await obsMarkerService.mark('RE:CONTROL TEST');
    return { ok, connected: obsMarkerService.isConnected() };
  });

  app.on('before-quit', () => {
    sysLogger.info('[App] Clean shutdown initiated...')
    try { votingManager.stop() } catch { /* ignore */ }
    try { overlayServer.stop() } catch { /* ignore */ }
    try { dbManager.close() } catch { /* ignore */ }
  })

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

  let activeTwitchChannel: string = '';

  // Bot chat commands: !karma / !top / !effects / !me / !help
  votingManager.setChatCommandHandler((command, username) => {
    if (!activeTwitchChannel) return;
    const reply = buildBotReply(command, username);
    if (reply) twitchBridge.sendMessage(activeTwitchChannel, reply);
  });

  // Stateful karma abilities and the session report answer directly
  votingManager.on('bot:reply', (message: string) => {
    mainWindow.webContents.send('simulator:syslog', { message });
    if (activeTwitchChannel) twitchBridge.sendMessage(activeTwitchChannel, message);
  });

  function buildBotReply(command: string, username: string): string | null {
    const top = dbManager.getTopKarma(5);
    switch (command) {
      case '!karma':
      case '!me': {
        const karma = dbManager.getViewerKarma(username);
        return `☣️ [UMBRELLA CORP] @${username}, твоя карма: ${karma > 0 ? '+' : ''}${karma}. !shield — ${VotingManager.SHIELD_COST} (нейтрализовать враждебный эффект, 1 раз за стрим), !reroll — ${VotingManager.REROLL_COST} (перебросить тройку).`;
      }
      case '!top': {
        if (top.length === 0) return `☣️ [UMBRELLA CORP] Лидерборд пуст — проголосуй цифрой 1-3!`;
        const lines = top.map((v, i) => `${i + 1}. ${v.username} (${v.karma > 0 ? '+' : ''}${v.karma})`).join(' | ');
        return `☣️ [UMBRELLA CORP] Топ оперативников: ${lines}`;
      }
      case '!effects': {
        const list = VOTABLE_EFFECTS.map(e => e.name.split(' (')[0]).join(', ');
        return `☣️ [UMBRELLA CORP] Пул эффектов (${VOTABLE_EFFECTS.length}): ${list}. Голосуй цифрой во время раунда! 5 голосов подряд = MEGA-версия.`;
      }
      case '!help':
        return `☣️ [UMBRELLA CORP] Команды: !karma — карма и цены способностей | !top — лидерборд | !effects — список эффектов | !shield — защита (${VotingManager.SHIELD_COST} кармы) | !reroll — переброска (${VotingManager.REROLL_COST}) | !report — итоги стрима. Во время раунда пиши 1, 2 или 3.`;
      default:
        return null;
    }
  }


  twitchBridge.onStatusChange((status) => {
    mainWindow.webContents.send('twitch:status', {
      connected: status.connected,
      channel: activeTwitchChannel,
      botUsername: status.botUsername,
      botAuthenticated: status.botAuthenticated,
      isMod: status.isMod
    })
  })

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
      twitchBridge.sendMessage(activeTwitchChannel, `☣️ [UMBRELLA CORP] Инициализирован био-протокол голосования! Модификаторы Леона (1-3): ${optionsText} (30 сек)`);
    }
  })

  votingManager.on('vote:intervention', (state) => {
    mainWindow.webContents.send('simulator:syslog', { message: state.message })
    overlayServer.broadcast('vote:intervention', state)
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `☣️ [UMBRELLA CORP] 🚨 ДИРЕКТИВА АМБРЕЛЛЫ: ${state.message}`);
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

  // Narrator: effect wins (skipped when a karma shield cancels the effect)
  votingManager.on('vote:end', ({ winner }) => {
    if (!winner) return;
    if (winner.category === 'negative') {
      narrator.say('negative_win')
    } else if (winner.category === 'positive') {
      narrator.say('positive_win')
    }
  })

  // Narrator: sfx for the new director events (v1.4.1)
  votingManager.on('director:mercy', () => {
    narrator.say('director_mercy')
  })

  votingManager.on('director:pulse', () => {
    narrator.say('director_pulse')
  })

  votingManager.on('mega:unlock', ({ displayName }) => {
    narrator.say('mega_unlock')
    mainWindow.webContents.send('simulator:syslog', { message: `MEGA UNLOCKED: ${displayName}` })
    overlayServer.broadcast('mega:unlock', { displayName })
    obsMarkerService.mark(`MEGA: ${displayName}`).catch(() => {})
  })

  votingManager.on('vote:shielded', () => {
    narrator.say('shield_saved')
  })

  narrator.on('narrator:speak', (data) => {
    overlayServer.broadcast('narrator:speak', data)
    mainWindow.webContents.send('narrator:speak', data)
  })

  narrator.on('narrator:audio', (data) => {
    overlayServer.broadcast('narrator:audio', data)
  })

  // Subtitle-only fallback when neither actor files nor TTS are available
  narrator.on('narrator:subtitle', (data) => {
    overlayServer.broadcast('narrator:speak', data)
    mainWindow.webContents.send('narrator:speak', data)
  })

  // ─── TTS FALLBACK (v1.4.1) ───
  ttsService.loadConfig()

  ipcMain.handle('tts:getConfig', () => ttsService.getConfig())
  ipcMain.handle('tts:setConfig', (_, patch) => ttsService.setConfig(patch))
  ipcMain.handle('tts:getStatus', async () => ({
    enabled: ttsService.isEnabled(),
    available: await ttsService.checkAvailability()
  }))
  ipcMain.handle('tts:warmCache', async () => {
    const generated = await ttsService.warmCache(getAllLines())
    return { generated, total: getAllLines().length }
  })

  // Warm the cache in the background so the first line plays instantly
  setTimeout(() => {
    if (ttsService.isEnabled()) {
      ttsService.warmCache(getAllLines()).catch((err) => {
        sysLogger.warn(`[TTS] Warm-up failed: ${err.message}`)
      })
    }
  }, 5000)

  ipcMain.on('narrator:toggle', (_, val: boolean) => {
    narrator.setEnabled(val)
  })

  ipcMain.handle('settings:setVolume', (_, vol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)))
    try {
      fs.writeFileSync(AUDIO_CONFIG_FILE, JSON.stringify({ volume: clamped }, null, 2))
    } catch (e) {}
    narrator.setVolume(clamped / 100)
    overlayServer.broadcast('narrator:set-volume', clamped / 100)
    return clamped
  })

  overlayServer.on('clients:update', (count: number) => {
    mainWindow.webContents.send('obs:status', { connected: count > 0, count })
  })

  ipcMain.handle('obs:getStatus', () => {
    const count = overlayServer.getClientCount()
    return { connected: count > 0, count }
  })

  ipcMain.handle('obs:getOverlayUrl', () => {
    return overlayServer.getOverlayUrl()
  })

  // --- WEB REMOTE (STREAM DECK) ---
  overlayServer.on('effect:trigger', (effectId: string) => {
    sysLogger.info(`[Main] Executing WebRemote effect: ${effectId}`);
    mainWindow.webContents.send('simulator:syslog', { message: `WEB REMOTE: ${effectId}` });
    gameBridge.sendCommand(effectId).catch((err) => {
      sysLogger.error(`[Main] Error executing WebRemote effect:`, err);
    });
  });

  overlayServer.on('vote:action', (action: string) => {
    sysLogger.info(`[Main] WebRemote vote action: ${action}`);
    if (action === 'start') {
      votingManager.startCycle();
    } else if (action === 'stop') {
      votingManager.stop();
    } else if (action === 'intervention') {
      (votingManager as any).rollIntervention(true);
    }
  });

  ipcMain.handle('remote:getInfo', async () => {
    try {
      const qr = await overlayServer.getQrCode();
      return {
        url: overlayServer.getLocalUrl(),
        qr,
        clients: overlayServer.getClientCount()
      };
    } catch (e: any) {
      return {
        url: overlayServer.getLocalUrl(),
        qr: '',
        clients: overlayServer.getClientCount()
      };
    }
  });

  ipcMain.handle('remote:triggerEffect', async (_, effectId: string) => {
    sysLogger.info(`[Main] Manual test trigger: ${effectId}`);
    mainWindow.webContents.send('simulator:syslog', { message: `MANUAL TEST: ${effectId}` });
    return gameBridge.sendCommand(effectId);
  });

  votingManager.on('vote:tick', (state) => {
    mainWindow.webContents.send('vote:update', state)
    overlayServer.broadcast('vote:update', state)
  })

  votingManager.on('vote:update', (state) => {
    mainWindow.webContents.send('vote:update', state)
    overlayServer.broadcast('vote:update', state)
  })

  votingManager.on('vote:end', ({ winner, state, shieldedBy, cancelled }) => {
    simulator.stopSimulating()
    mainWindow.webContents.send('vote:update', state)

    if (!winner) {
      if (shieldedBy) {
        // Karma shield cancelled a hostile effect
        mainWindow.webContents.send('simulator:syslog', { message: `SHIELD: ${shieldedBy} cancelled ${cancelled}` })
        overlayServer.broadcast('vote:shielded', { by: shieldedBy, cancelled })
        mainWindow.webContents.send('vote:shielded', { by: shieldedBy, cancelled })
        if (activeTwitchChannel) {
          twitchBridge.sendMessage(activeTwitchChannel, `☣️ [UMBRELLA CORP] 🛡 ЗАЩИТНЫЙ ПРОТОКОЛ @${shieldedBy}: враждебный модификатор [ ${cancelled} ] нейтрализован.`);
        }
      } else {
        // Boss round lacked the required turnout — the effect never lands
        const boss = state.boss
        mainWindow.webContents.send('simulator:syslog', { message: `BOSS FAILED: ${cancelled} (${boss?.votes ?? 0}/${boss?.threshold ?? 0})` })
        overlayServer.broadcast('boss:failed', { cancelled, votes: boss?.votes ?? 0, threshold: boss?.threshold ?? 0 })
        if (activeTwitchChannel) {
          twitchBridge.sendMessage(activeTwitchChannel, `☣️ [UMBRELLA CORP] 💀 БОСС-РАУНД ПРОВАЛЕН: явка ${boss?.votes ?? 0}/${boss?.threshold ?? 0}. Модификатор [ ${cancelled} ] не активирован.`);
        }
      }
      return
    }

    mainWindow.webContents.send('simulator:syslog', { message: 'WINNER: ' + winner.displayName })
    overlayServer.broadcast('vote:end', { winner, state })

    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `☣️ [UMBRELLA CORP] 🏆 Протокол завершен: [ ${winner.displayName} ] активирован (${winner.votes} голосов)!`);
    }

    // Send effect to the game, then announce on the overlay for as long as the game reports it active
    gameBridge.sendCommand(winner.effectId).then((result) => {
      let durationMs = 8000;
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        const reported = parsed && typeof parsed.duration === 'number' ? parsed.duration * 1000 : NaN;
        if (!isNaN(reported) && reported > 0) durationMs = Math.min(reported, 120000);
      } catch {}
      overlayServer.broadcast('effect:start', { effect: winner.displayName, duration: durationMs })
      setTimeout(() => {
        overlayServer.broadcast('effect:end', { effect: winner.displayName })
      }, durationMs)
    }).catch((err) => { console.warn('Bridge timeout (Game Offline):', err.message); mainWindow.webContents.send('simulator:syslog', { message: 'GAME OFFLINE: Effect not executed.' }); })
  })

  votingManager.on('trusted:count', (count) => {
    mainWindow.webContents.send('trusted:count', count)
  })

  votingManager.on('traitor:start', (state) => {
    simulator.stopSimulating()
    if (!activeTwitchChannel) {
      simulator.setTraitor(state.username)
    }
    mainWindow.webContents.send('traitor:start', state)
    mainWindow.webContents.send('simulator:syslog', { message: `TRAITOR MODE STARTED! Traitor: ${state.username}` })
    overlayServer.broadcast('traitor:start', state)
    obsMarkerService.mark(`TRAITOR: @${state.username}`).catch(() => {})
    
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `☣️ [UMBRELLA CORP] 💀 КРИТИЧЕСКАЯ УГРОЗА! Предатель @${state.username} перехватил терминал био-контроля!`);
    }
  })

  votingManager.on('traitor:end', (state) => {
    simulator.setTraitor(null)
    if (!activeTwitchChannel) {
      simulator.startSimulating(500)
    }
    mainWindow.webContents.send('traitor:end', state)
    mainWindow.webContents.send('simulator:syslog', { message: `TRAITOR MODE ENDED!` })
    if (activeTwitchChannel) {
      twitchBridge.sendMessage(activeTwitchChannel, `☣️ [UMBRELLA CORP] Контроль над объектом восстановлен. Возврат в стандартный протокол.`);
    }
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
  ipcMain.handle('audio:get-files', async () => {
    const fsPromises = require('node:fs/promises');
    const base = getAudioBasePath()
    const result: Record<string, string[]> = {}
    if (fs.existsSync(base)) {
      const folders = await fsPromises.readdir(base)
      for (const f of folders) {
        const folderPath = join(base, f)
        const stat = await fsPromises.stat(folderPath)
        if (stat.isDirectory()) {
          const files = await fsPromises.readdir(folderPath)
          result[f] = files.filter((file: string) => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg'))
        }
      }
    }
    return result
  })

  ipcMain.handle('audio:read-file', async (_, folder: string, file: string) => {
    const fsPromises = require('node:fs/promises');
    const path = require('node:path');
    const base = path.resolve(getAudioBasePath());
    const filePath = path.resolve(base, folder, file);
    if (!filePath.startsWith(base)) {
      sysLogger.warn(`[Security] Path traversal attempt blocked in audio:read-file: folder=${folder}, file=${file}`);
      return null;
    }
    if (fs.existsSync(filePath)) {
      const buffer = await fsPromises.readFile(filePath);
      return buffer.toString('base64');
    }
    return null;
  });

  
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
          const exes = ['re2.exe', 're3.exe', 're4.exe'];
          let targetExe: string = "";
          for (const exe of exes) {
            const possiblePath = join(conf.gamePath, exe);
            if (fs.existsSync(possiblePath)) {
              targetExe = possiblePath;
              break;
            }
          }

          if (targetExe === "") {
            sysLogger.warn('[Game] No known game executable found in path, aborting launch.');
            mainWindow.webContents.send('simulator:syslog', { message: 'GAME LAUNCH FAILED: .exe not found' });
            return false;
          }

          sysLogger.info(`[Game] Launching: ${targetExe}`);
          execFile(targetExe, [], { cwd: conf.gamePath }, (error) => {
            if (error) {
              // Steam DRM or missing runtime: fall back to the Steam protocol
              const steamIds: Record<string, string> = { 're2.exe': '883710', 're3.exe': '1172620', 're4.exe': '2050650' };
              const exeName = targetExe.split('\\').pop() || '';
              const steamId = steamIds[exeName];
              if (steamId) {
                sysLogger.warn(`[Game] Direct launch failed (${error.message}). Retrying via Steam (app ${steamId}).`);
                shell.openExternal(`steam://rungameid/${steamId}`);
              } else {
                sysLogger.error(`[Game Launch Error]: ${error.message}`);
              }
            }
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
        mainWindow.webContents.send('twitch:status', { 
            connected: true, 
            channel, 
            botUsername: twitchBridge.botUsername, 
            botAuthenticated: twitchBridge.isBotAuthenticated,
            isMod: twitchBridge.isMod 
        })
        overlayServer.broadcast('twitch:connected', { channel })
    }).catch(err => {
        sysLogger.error('Twitch connection failed', err);
        mainWindow.webContents.send('simulator:syslog', { message: 'TWITCH CONNECTION FAILED!' })
        mainWindow.webContents.send('twitch:status', { 
            connected: false, 
            channel: '', 
            botUsername: '', 
            botAuthenticated: false,
            isMod: false 
        })
    });
  })

  ipcMain.on('twitch:disconnect', () => {
    activeTwitchChannel = '';
    twitchBridge.disconnect()
    votingManager.stop()
    mainWindow.webContents.send('simulator:syslog', { message: 'TWITCH DISCONNECTED' })
    mainWindow.webContents.send('twitch:status', { 
        connected: false, 
        channel: '', 
        botUsername: '', 
        botAuthenticated: false,
        isMod: false 
    })
    overlayServer.broadcast('twitch:disconnected', {})
  })

  ipcMain.handle('twitch:sendTestPing', async (_, channelInput?: string) => {
    const target = channelInput?.trim() || activeTwitchChannel;
    if (!target) {
      return { success: false, error: 'Канал стримера не указан' };
    }
    return await twitchBridge.sendTestPing(target);
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

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length > 0) {
      const mainWindow = allWindows[0]
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.djoystick.re-control')
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })
    createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})



















