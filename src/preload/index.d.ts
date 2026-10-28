export {}

declare global {
  interface Window {
    electron?: any
    api: {
      versions?: NodeJS.ProcessVersions
      startSimulator: () => void
      stopSimulator: () => void
      updateSettings: (settings: any) => void
      connectTwitch: (channel: string) => void
      disconnectTwitch: () => void
      onTwitchStatus: (callback: (status: any) => void) => () => void
      closeWindow: () => void
      minimizeWindow: () => void
      onSimulatorLog: (callback: (cmd: any) => void) => () => void
      onSimulatorSyslog: (callback: (data: any) => void) => () => void
      onVoteUpdate: (callback: (state: any) => void) => () => void
      getLeaderboard: () => Promise<any>
      getSessionReport: () => Promise<any>
      publishReport: () => Promise<any>
      invokeTraitor: () => Promise<boolean>
      onTraitorStart: (callback: (state: any) => void) => () => void
      onTraitorEnd: (callback: (state: any) => void) => () => void
      onTrustedCount: (callback: (count: number) => void) => () => void
      removeListener?: (channel: string, listener: (...args: any[]) => void) => void
      saveTwitchAuth: (username: string, token: string, channel: string) => Promise<{ success: boolean; error?: string }>
      getTwitchAuth: () => Promise<{ username: string; token?: string; hasToken: boolean; maskedToken: string; channel?: string } | null>
      validateTwitchToken: (token: string) => Promise<boolean>
      sendTwitchTestPing: (channel?: string) => Promise<{ success: boolean; message?: string; error?: string }>
      
      // Setup Wizard API
      getGames: () => Promise<any[]>
      findGame: (steamAppId: string, exeName: string) => Promise<{ found: boolean; path?: string }>
      browseExe: () => Promise<{ canceled: boolean; filePaths: string[] }>
      install: (gamePath: string, archiveName: string) => Promise<void>
      updateScripts: (gamePath: string) => Promise<void>
      onInstallProgress: (cb: (data: { percent: number; message: string }) => void) => () => void
      saveStoredGamePath: (path: string) => Promise<void>
      getStoredGamePath: () => Promise<string | null>
      getHotkeys: () => Promise<{ traitor: string; intervention: string }>
      saveHotkeys: (hotkeys: { traitor: string; intervention: string }) => Promise<void>
      getVolume: () => Promise<number>
      setVolume: (volume: number) => Promise<number>
      getObsStatus: () => Promise<{ connected: boolean; count: number }>
      getOverlayUrl: () => Promise<string>
      getDirectorConfig: () => Promise<any>
      saveDirectorConfig: (config: any) => Promise<any>
      getTtsConfig: () => Promise<{ enabled: boolean; pythonCommand?: string }>
      setTtsConfig: (patch: any) => Promise<any>
      getTtsStatus: () => Promise<{ enabled: boolean; available: boolean }>
      warmTtsCache: () => Promise<{ generated: number; total: number }>
      onObsStatus: (cb: (data: { connected: boolean; count: number }) => void) => () => void
      getRemoteInfo: () => Promise<{ url: string; qr: string; clients: number }>
      triggerEffect: (effectId: string) => Promise<string>
    }
  }
}



