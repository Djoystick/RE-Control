import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      startSimulator: () => void
      stopSimulator: () => void
      updateSettings: (settings: any) => void
      connectTwitch: (channel: string) => void
      disconnectTwitch: () => void
      onTwitchStatus: (callback: (status: any) => void) => void
      closeWindow: () => void
      minimizeWindow: () => void
      onSimulatorLog: (callback: (cmd: any) => void) => void
      onSimulatorSyslog: (callback: (data: any) => void) => void
      onVoteUpdate: (callback: (state: any) => void) => void
      getLeaderboard: () => Promise<any>
      invokeTraitor: () => Promise<boolean>
      onTraitorStart: (callback: (state: any) => void) => void
      onTraitorEnd: (callback: (state: any) => void) => void
      onTrustedCount: (callback: (count: number) => void) => void
      saveTwitchAuth: (username: string, token: string, channel: string) => Promise<void>
      getTwitchAuth: () => Promise<{ username: string; token: string; channel?: string } | null>
      validateTwitchToken: (token: string) => Promise<boolean>
      
      // Setup Wizard API
      getGames: () => Promise<any[]>
      findGame: (steamAppId: string, exeName: string) => Promise<{ found: boolean; path?: string }>
      browseExe: () => Promise<{ canceled: boolean; filePaths: string[] }>
      install: (gamePath: string, archiveName: string) => Promise<void>
      updateScripts: (gamePath: string) => Promise<void>
      onInstallProgress: (cb: (data: { percent: number; message: string }) => void) => void
      saveStoredGamePath: (path: string) => Promise<void>
      getStoredGamePath: () => Promise<string | null>
    }
  }
}



