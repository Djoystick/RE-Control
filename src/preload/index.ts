import { contextBridge, ipcRenderer } from 'electron'

const api = {
  startSimulator: () => ipcRenderer.send('simulator:start'),
  stopSimulator: () => ipcRenderer.send('simulator:stop'),
  simulatorCombo: (optionId: number) => ipcRenderer.send('simulator:combo', optionId),
  narratorToggle: (val: boolean) => ipcRenderer.send('narrator:toggle', val),
  onNarratorSpeak: (callback: (data: { text: string; eventType: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('narrator:speak', handler)
    return () => ipcRenderer.removeListener('narrator:speak', handler)
  },
  updateSettings: (settings: any) => ipcRenderer.send('settings:update', settings),
  connectTwitch: (channel: string) => ipcRenderer.send('twitch:connect', channel),
  disconnectTwitch: () => ipcRenderer.send('twitch:disconnect'),
  onTwitchStatus: (callback: (status: any) => void) => {
    const handler = (_: any, status: any) => callback(status)
    ipcRenderer.on('twitch:status', handler)
    return () => ipcRenderer.removeListener('twitch:status', handler)
  },
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  onSimulatorLog: (callback: (cmd: any) => void) => {
    const handler = (_: any, cmd: any) => callback(cmd)
    ipcRenderer.on('simulator:log', handler)
    return () => ipcRenderer.removeListener('simulator:log', handler)
  },
  onSimulatorSyslog: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('simulator:syslog', handler)
    return () => ipcRenderer.removeListener('simulator:syslog', handler)
  },
  onVoteUpdate: (callback: (state: any) => void) => {
    const handler = (_: any, state: any) => callback(state)
    ipcRenderer.on('vote:update', handler)
    return () => ipcRenderer.removeListener('vote:update', handler)
  },
  invokeTraitor: () => ipcRenderer.invoke('simulator:invokeTraitor'),
  simulateDonation: (amount: number) => ipcRenderer.send('simulator:donate', amount),
  onTraitorStart: (callback: (state: any) => void) => {
    const handler = (_: any, state: any) => callback(state)
    ipcRenderer.on('traitor:start', handler)
    return () => ipcRenderer.removeListener('traitor:start', handler)
  },
  onTraitorEnd: (callback: (state: any) => void) => {
    const handler = (_: any, state: any) => callback(state)
    ipcRenderer.on('traitor:end', handler)
    return () => ipcRenderer.removeListener('traitor:end', handler)
  },
  onTrustedCount: (callback: (count: number) => void) => {
    const handler = (_: any, count: any) => callback(count)
    ipcRenderer.on('trusted:count', handler)
    return () => ipcRenderer.removeListener('trusted:count', handler)
  },
  removeListener: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, listener)
  },
  getLeaderboard: () => ipcRenderer.invoke('db:getLeaderboard'),
  getSessionReport: () => ipcRenderer.invoke('db:getSessionReport'),
  publishReport: () => ipcRenderer.invoke('db:publishReport'),
  saveTwitchAuth: (username: string, token: string, channel: string) => ipcRenderer.invoke('settings:saveTwitchAuth', { username, token, channel }),
  getTwitchAuth: () => ipcRenderer.invoke('settings:getTwitchAuth'),
  validateTwitchToken: (token: string) => ipcRenderer.invoke('twitch:validateToken', token),
  sendTwitchTestPing: (channel?: string) => ipcRenderer.invoke('twitch:sendTestPing', channel),

  // Setup Wizard API
  getGames: () => ipcRenderer.invoke('setup:getGames'),
  findGame: (steamAppId: string, exeName: string) =>
    ipcRenderer.invoke('setup:findGame', { steamAppId, exeName }),
  browseExe: () => ipcRenderer.invoke('setup:browseExe'),
  install: (gamePath: string, archiveName: string) =>
    ipcRenderer.invoke('setup:install', { gamePath, archiveName }),
  updateScripts: (gamePath: string) =>
    ipcRenderer.invoke('setup:updateScripts', { gamePath }),
  onInstallProgress: (cb: (data: { percent: number; message: string }) => void) => {
    const handler = (_: any, d: any) => cb(d)
    ipcRenderer.on('install:progress', handler)
    return () => ipcRenderer.removeListener('install:progress', handler)
  },
  saveStoredGamePath: (path: string) => ipcRenderer.invoke('setup:saveGamePath', path),
  getStoredGamePath: () => ipcRenderer.invoke('setup:getStoredGamePath'),
  launchGame: () => ipcRenderer.invoke('game:launch'),
  getHotkeys: () => ipcRenderer.invoke('settings:getHotkeys'),
  saveHotkeys: (hotkeys: any) => ipcRenderer.invoke('settings:saveHotkeys', hotkeys),
  getVolume: () => ipcRenderer.invoke('settings:getVolume'),
  setVolume: (volume: number) => ipcRenderer.invoke('settings:setVolume', volume),
  getObsStatus: () => ipcRenderer.invoke('obs:getStatus'),
  getOverlayUrl: () => ipcRenderer.invoke('obs:getOverlayUrl'),
  getDirectorConfig: () => ipcRenderer.invoke('settings:getDirector'),
  saveDirectorConfig: (config: any) => ipcRenderer.invoke('settings:saveDirector', config),
  getTtsConfig: () => ipcRenderer.invoke('tts:getConfig'),
  setTtsConfig: (patch: any) => ipcRenderer.invoke('tts:setConfig', patch),
  getTtsStatus: () => ipcRenderer.invoke('tts:getStatus'),
  warmTtsCache: () => ipcRenderer.invoke('tts:warmCache'),
  getObsMarkerConfig: () => ipcRenderer.invoke('obs:getMarkerConfig'),
  setObsMarkerConfig: (patch: any) => ipcRenderer.invoke('obs:setMarkerConfig', patch),
  testObsMarker: () => ipcRenderer.invoke('obs:testMarker'),
  getSessionSnapshot: () => ipcRenderer.invoke('session:get'),
  resetSession: () => ipcRenderer.invoke('session:reset'),
  onObsStatus: (cb: (data: { connected: boolean; count: number }) => void) => {
    const handler = (_: any, d: any) => cb(d)
    ipcRenderer.on('obs:status', handler)
    return () => ipcRenderer.removeListener('obs:status', handler)
  },
    getRemoteInfo: () => ipcRenderer.invoke('remote:getInfo'),
    triggerEffect: (effectId: string) => ipcRenderer.invoke('remote:triggerEffect', effectId),
    versions: process.versions
  }

  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
      console.error(error)
    }
  } else {
    // @ts-ignore
    window.api = api
  }







