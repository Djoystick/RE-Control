import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  startSimulator: () => ipcRenderer.send('simulator:start'),
  stopSimulator: () => ipcRenderer.send('simulator:stop'),
  updateSettings: (settings: any) => ipcRenderer.send('settings:update', settings),
  connectTwitch: (channel: string) => ipcRenderer.send('twitch:connect', channel),
  disconnectTwitch: () => ipcRenderer.send('twitch:disconnect'),
  onTwitchStatus: (callback: (status: any) => void) => {
    ipcRenderer.removeAllListeners('twitch:status')
    ipcRenderer.on('twitch:status', (_, status) => callback(status))
  },
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  onSimulatorLog: (callback: (cmd: any) => void) => {
    ipcRenderer.removeAllListeners('simulator:log')
    ipcRenderer.on('simulator:log', (_, cmd) => callback(cmd))
  },
  onSimulatorSyslog: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('simulator:syslog')
    ipcRenderer.on('simulator:syslog', (_, data) => callback(data))
  },
  onVoteUpdate: (callback: (state: any) => void) => {
    ipcRenderer.removeAllListeners('vote:update')
    ipcRenderer.on('vote:update', (_, state) => callback(state))
  },
  invokeTraitor: () => ipcRenderer.invoke('simulator:invokeTraitor'),
  simulateDonation: (amount: number) => ipcRenderer.send('simulator:donate', amount),
  onTraitorStart: (callback: (state: any) => void) => {
    ipcRenderer.removeAllListeners('traitor:start')
    ipcRenderer.on('traitor:start', (_, state) => callback(state))
  },
  onTraitorEnd: (callback: (state: any) => void) => {
    ipcRenderer.removeAllListeners('traitor:end')
    ipcRenderer.on('traitor:end', (_, state) => callback(state))
  },
  onTrustedCount: (callback: (count: number) => void) => {
    ipcRenderer.removeAllListeners('trusted:count')
    ipcRenderer.on('trusted:count', (_, count) => callback(count))
  },
  getLeaderboard: () => ipcRenderer.invoke('db:getLeaderboard'),
  saveTwitchAuth: (username: string, token: string, channel: string) => ipcRenderer.invoke('settings:saveTwitchAuth', { username, token, channel }),
  getTwitchAuth: () => ipcRenderer.invoke('settings:getTwitchAuth'),
  validateTwitchToken: (token: string) => ipcRenderer.invoke('twitch:validateToken', token),

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
    ipcRenderer.removeAllListeners('install:progress');
    ipcRenderer.on('install:progress', (_, d) => cb(d));
  },
  saveStoredGamePath: (path: string) => ipcRenderer.invoke('setup:saveGamePath', path),
  getStoredGamePath: () => ipcRenderer.invoke('setup:getStoredGamePath')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}






