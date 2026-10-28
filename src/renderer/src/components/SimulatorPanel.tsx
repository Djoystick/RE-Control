import React, { useState, useEffect, useRef } from 'react'
import { 
  Play, 
  Square, 
  Clock, 
  Skull, 
  Loader2, 
  Radio, 
  CheckCircle2, 
  XCircle, 
  Radar, 
  Volume2, 
  Tv, 
  Flame, 
  Trash2, 
  Copy, 
  Check, 
  Gamepad2,
  Smartphone,
  QrCode,
  ExternalLink,
  Zap,
  ShieldCheck,
  Bot,
  Send,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TiersConfigurator } from './TiersConfigurator'
import { VoiceTester } from './VoiceTester'

export const SimulatorPanel: React.FC<{ onReinstall?: () => void }> = ({ onReinstall }) => {
  const [logs, setLogs] = useState<any[]>([ 
    { type: 'system', message: 'МОСТ RE:CONTROL ИНИЦИАЛИЗИРОВАН', timestamp: new Date().toLocaleTimeString() } 
  ])
  const [voteState, setVoteState] = useState<any>(null)
  const [twitchChannel, setTwitchChannel] = useState<string>('')
  const [twitchStatus, setTwitchStatus] = useState<{
    connected: boolean;
    channel: string;
    botAuthenticated?: boolean;
    isMod?: boolean;
    botUsername?: string;
  }>({ connected: false, channel: '' })
  const [copiedModCommand, setCopiedModCommand] = useState<boolean>(false)
  const [pingStatus, setPingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [pingMessage, setPingMessage] = useState<string>('')
  const [lastWinner, setLastWinner] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  
  const [traitorState, setTraitorState] = useState<any>(null)
  const [trustedCount, setTrustedCount] = useState<number>(0)
  const [showTester, setShowTester] = useState<boolean>(false)
  
  // HUD & Volume States
  const [streamMode, setStreamMode] = useState<'live' | 'sandbox'>('live')
  const [obsStatus, setObsStatus] = useState<{ connected: boolean; count: number }>({ connected: false, count: 0 })
  const [masterVolume, setMasterVolume] = useState<number>(80)
  const [copiedOverlay, setCopiedOverlay] = useState<boolean>(false)
  const [logFilter, setLogFilter] = useState<'all' | 'system' | 'chat'>('all')

  // Token validation state
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [showPassword, setShowPassword] = useState<boolean>(false)

  // Tab and Bot Settings state
  const [activeTab, setActiveTab] = useState<'control' | 'twitch' | 'tiers' | 'debug' | 'settings'>('control')
  
  const [botUsername, setBotUsername] = useState<string>('')
  const [botToken, setBotToken] = useState<string>('')

  const [hotkeys, setHotkeys] = useState({ traitor: '', intervention: '', panic: 'CommandOrControl+Shift+P' })
  const [director, setDirector] = useState({
    enabled: true,
    lowEngagementThreshold: 0.25,
    quietInterventionChance: 0.6,
    mercyStreak: 3,
    winnerCooldownRounds: 2,
    unseenThreshold: 2,
    bossRoundChance: 0.1,
    bossThreshold: 12
  })
  const [ttsConfig, setTtsConfig] = useState({ enabled: true })
  const [ttsStatus, setTtsStatus] = useState<{ enabled: boolean; available: boolean } | null>(null)
  const [ttsWarm, setTtsWarm] = useState<string>('')
  const [obsMarkerStatus, setObsMarkerStatus] = useState<string>('')
  const [remoteInfo, setRemoteInfo] = useState<{ url: string; qr: string; clients: number } | null>(null)
  const [copiedRemote, setCopiedRemote] = useState<boolean>(false)
  const [testSuccessEffect, setTestSuccessEffect] = useState<string | null>(null)

  const logsEndRef = useRef<HTMLDivElement>(null)

  const fetchLeaderboard = async () => {
    if (window.api?.getLeaderboard) {
      const top = await window.api.getLeaderboard()
      setLeaderboard(top || [])
    }
  }

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    window.api?.getHotkeys?.().then((h: any) => {
      if (h) setHotkeys(h)
    })

    window.api?.getDirectorConfig?.().then((d: any) => {
      if (d) setDirector((prev) => ({ ...prev, ...d }))
    })

    window.api?.getTtsConfig?.().then((c: any) => {
      if (c) setTtsConfig((prev) => ({ ...prev, ...c }))
    })

    window.api?.getVolume?.().then((v: number) => {
      if (typeof v === 'number') setMasterVolume(v)
    })

    window.api?.getObsStatus?.().then((status: any) => {
      if (status) setObsStatus(status)
    })

    const fetchRemote = () => {
      window.api?.getRemoteInfo?.().then((info: any) => {
        if (info) setRemoteInfo(info)
      })
    }
    fetchRemote()
    const remoteInterval = setInterval(fetchRemote, 6000)

    if (!window.api) return

    const handleSimulatorLog = (cmd: any) => {
      setLogs((prev) => [...prev, { ...cmd, timestamp: new Date().toLocaleTimeString() }].slice(-100))
    }
    
    const handleSimulatorSyslog = (sys: any) => {
      if (sys?.message?.startsWith('WINNER:')) setLastWinner(sys?.message?.replace('WINNER: ', ''))
      setLogs((prev) => [...prev, { type: 'system', message: sys?.message, timestamp: new Date().toLocaleTimeString() }].slice(-100))
    }

    const handleVoteUpdate = (state: any) => {
      setVoteState(state)
    }

    const handleTwitchStatus = (status: any) => {
      if (status) setTwitchStatus(status)
    }
    
    const handleTraitorStart = (state: any) => {
      setTraitorState(state)
    }
    
    const handleTraitorEnd = () => {
      setTraitorState(null)
    }
    
    const handleTrustedCount = (count: any) => {
      setTrustedCount(count)
    }

    const handleObsStatus = (status: { connected: boolean; count: number }) => {
      if (status) setObsStatus(status)
    }

    const unsubs: (() => void)[] = []
    if (window.api.onSimulatorLog) unsubs.push(window.api.onSimulatorLog(handleSimulatorLog) as any)
    if (window.api.onSimulatorSyslog) unsubs.push(window.api.onSimulatorSyslog(handleSimulatorSyslog) as any)
    if (window.api.onVoteUpdate) unsubs.push(window.api.onVoteUpdate(handleVoteUpdate) as any)
    if (window.api.onTwitchStatus) unsubs.push(window.api.onTwitchStatus(handleTwitchStatus) as any)
    if (window.api.onTraitorStart) unsubs.push(window.api.onTraitorStart(handleTraitorStart) as any)
    if (window.api.onTraitorEnd) unsubs.push(window.api.onTraitorEnd(handleTraitorEnd) as any)
    if (window.api.onTrustedCount) unsubs.push(window.api.onTrustedCount(handleTrustedCount) as any)
    if (window.api.onObsStatus) unsubs.push(window.api.onObsStatus(handleObsStatus) as any)

    window.api.updateSettings?.({ cooldownMs: 600000 })
    
    if (window.api.getTwitchAuth) {
      window.api.getTwitchAuth().then((auth: any) => {
        if (auth) {
          setBotUsername(auth.username || '')
          setBotToken(auth.maskedToken || auth.token || '')
          if (auth.channel) setTwitchChannel(auth.channel)
        }
      })
    }

    return () => {
      clearInterval(remoteInterval)
      unsubs.forEach(u => typeof u === 'function' && u())
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    if (!botToken) {
      setTokenStatus('idle')
      return
    }

    setTokenStatus('validating')
    
    const timer = setTimeout(async () => {
      if (window.api?.validateTwitchToken) {
        try {
          const isValid = await window.api.validateTwitchToken(botToken)
          setTokenStatus(isValid ? 'valid' : 'invalid')
        } catch (e) {
          setTokenStatus('invalid')
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [botToken])

  const handleVolumeChange = (newVol: number) => {
    setMasterVolume(newVol)
    window.api?.setVolume?.(newVol)
  }

  const copyOverlayLink = async () => {
    try {
      const url = await window.api?.getOverlayUrl?.()
      navigator.clipboard.writeText(url || 'http://localhost:27016/overlay')
    } catch (e) {
      navigator.clipboard.writeText('http://localhost:27016/overlay')
    }
    setCopiedOverlay(true)
    setTimeout(() => setCopiedOverlay(false), 2000)
  }

  const copyModCommand = () => {
    const name = botUsername.trim() || 'UmbrellaCorp_Bot'
    navigator.clipboard.writeText(`/mod ${name}`)
    setCopiedModCommand(true)
    setTimeout(() => setCopiedModCommand(false), 2000)
  }

  const handleSendTestPing = async () => {
    if (!twitchChannel || pingStatus === 'sending') return
    setPingStatus('sending')
    setPingMessage('')
    try {
      const res = await window.api?.sendTwitchTestPing?.(twitchChannel)
      if (res?.success) {
        setPingStatus('success')
        setPingMessage(res.message || 'Тестовый протокол связи успешен!')
      } else {
        setPingStatus('error')
        setPingMessage(res?.error || 'Ошибка отправки тестового сообщения')
      }
    } catch (e: any) {
      setPingStatus('error')
      setPingMessage(e?.message || 'Ошибка вызова API')
    }
    setTimeout(() => {
      setPingStatus('idle')
      setPingMessage('')
    }, 4500)
  }

  const filteredLogs = logs.filter(log => {
    if (logFilter === 'system') return log.type === 'system'
    if (logFilter === 'chat') return log.type !== 'system'
    return true
  })

  const renderVotingUI = () => {
    if (traitorState?.active) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#18090a] border border-red-800/80 p-2.5 rounded relative flex flex-col h-full shadow-[0_0_15px_rgba(220,38,38,0.2)]"
        >
          <div className="flex justify-between items-center mb-1.5 border-b border-red-900/40 pb-1 flex-shrink-0">
            <div className="text-red-400 font-mono font-bold flex items-center gap-1.5 text-xs uppercase">
              <Skull size={14} className="text-red-500" /> РЕЖИМ ПРЕДАТЕЛЯ
            </div>
            <div className="text-zinc-100 font-mono font-bold text-xs">
              {Math.ceil((traitorState.timeRemainingMs || 0) / 1000)}с
            </div>
          </div>
          <div className="text-center mb-1.5 flex-shrink-0">
            <h3 className="text-zinc-200 font-mono font-bold text-[11px] uppercase">
              ПРЕДАТЕЛЬ <span className="text-red-400 font-bold">@{traitorState.username || 'НЕИЗВЕСТНО'}</span> ПОЛУЧИЛ ВЛАСТЬ
            </h3>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            {(traitorState?.options || []).map((opt: any, index: number) => (
              <div key={opt?.id ?? index} className="bg-[#0b0c10] border border-red-950/80 p-1.5 rounded text-zinc-300 flex justify-between items-center text-[10px] font-mono">
                <span>[{opt?.id}] {opt?.displayName}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )
    }

    if (!voteState || !voteState.isActive) {
      return (
        <div className="bg-[#0e1017] border border-[#202433] p-2 text-center rounded flex flex-col items-center justify-center h-full shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
          <Clock size={16} className="text-zinc-500 mb-1" />
          <span className="text-zinc-300 text-[11px] uppercase tracking-wider font-mono font-bold">
            ОЖИДАНИЕ СЛЕДУЮЩЕГО РАУНДА
          </span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
            Голосование начнётся по кулдауну или донату
          </span>
          {lastWinner && (
            <div className="mt-1 text-red-400 font-mono font-bold uppercase text-[10px] bg-red-950/30 px-2 py-0.5 rounded border border-red-900/40">
              ПОБЕДИТЕЛЬ: {lastWinner}
            </div>
          )}
        </div>
      )
    }

    return (
      <motion.div 
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0e1017] border border-red-900/60 p-2.5 rounded relative flex flex-col h-full shadow-[0_0_10px_rgba(220,38,38,0.15)]"
      >
        <div className="flex justify-between items-center mb-1.5 border-b border-[#222634] pb-1 flex-shrink-0">
          <div className="text-red-400 font-mono font-bold flex items-center gap-1.5 text-xs uppercase tracking-wide">
            <Radio size={13} className="text-red-500" /> ИДЁТ ГОЛОСОВАНИЕ
          </div>
          <div className="text-red-400 font-mono font-bold text-sm">
            {Math.ceil((voteState?.timeRemainingMs || 0) / 1000)}с
          </div>
        </div>

        {voteState?.intervention && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 font-mono text-[10px] uppercase p-1.5 mb-1.5 text-center rounded flex-shrink-0">
            ⚠️ {voteState.intervention.message}
          </div>
        )}
        
        <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {(voteState?.options || []).map((opt: any, index: number) => {
            const percentage = ((voteState?.totalVotes || 0) > 0) 
              ? Math.round(((opt?.votes || 0) / voteState.totalVotes) * 100) 
              : 0
            
            const isBlind = voteState?.intervention?.type === 'blind'
            const displayVotes = isBlind ? '???' : opt?.votes || 0
            const displayPercentage = isBlind ? '???%' : `${percentage}%`
            const barWidth = isBlind ? '50%' : `${percentage}%`

            return (
              <div key={opt?.id ?? index} className="relative">
                <div className="flex justify-between text-[10px] font-mono text-zinc-300 mb-0.5">
                  <span>[{opt?.id}] {opt?.displayName}</span>
                  <span className={isBlind ? "text-red-400 font-bold" : "text-zinc-400 font-bold"}>
                    {displayVotes} ({displayPercentage})
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#08090d] border border-[#1e2230] rounded overflow-hidden">
                  <motion.div 
                    className={`h-full ${isBlind ? 'bg-red-700' : 'bg-red-600'}`} 
                    initial={{ width: 0 }}
                    animate={{ width: barWidth }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="bg-[#0a0c10] border border-[#1e2330] rounded-lg p-2.5 relative h-full flex flex-col gap-2 overflow-hidden text-zinc-200 font-mono">
      {/* BACKGROUND TEXTURE */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38bIxsDBBgAEGAAZTwF85bZzQ8AAAAASUVORK5CYII=')]"></div>
      
      {/* 1. TOP HUD BAR */}
      <div className="relative z-10 flex items-center justify-between bg-[#0e1017] border border-[#1e2332] px-2.5 py-1 rounded text-xs gap-2 flex-shrink-0">
        
        {/* Left: Mode Toggle */}
        <div className="flex items-center gap-1 bg-[#090a0f] p-0.5 rounded border border-[#1c202d] flex-shrink-0">
          <button
            onClick={() => setStreamMode('live')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
              streamMode === 'live'
                ? 'bg-red-950/60 text-red-200 border border-red-800/80 shadow-[0_0_8px_rgba(220,38,38,0.2)]'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${streamMode === 'live' ? 'bg-red-500' : 'bg-zinc-600'}`} />
            СТРИМ (LIVE)
          </button>
          <button
            onClick={() => setStreamMode('sandbox')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
              streamMode === 'sandbox'
                ? 'bg-[#181b26] text-zinc-100 border border-[#2b3042]'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            ПЕСОЧНИЦА
          </button>
        </div>

        {/* Center: Tactical Status Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Twitch Badge */}
          <div 
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase whitespace-nowrap ${
              twitchStatus.connected 
                ? 'bg-[#0a120e] border-emerald-900/60 text-emerald-400' 
                : 'bg-[#0b0d13] border-[#1e2230] text-zinc-500'
            }`}
            title={twitchStatus.connected ? `Twitch канал: #${twitchStatus.channel}` : 'Twitch чат отключен'}
          >
            <Radar size={11} className={twitchStatus.connected ? 'text-emerald-400' : 'text-zinc-600'} />
            <span>{twitchStatus.connected ? `@${twitchStatus.channel}` : 'TWITCH: ВЫКЛ'}</span>
          </div>

          {/* OBS Overlay Badge */}
          <div 
            onClick={copyOverlayLink}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono uppercase whitespace-nowrap cursor-pointer transition-all ${
              obsStatus.connected 
                ? 'bg-[#0a120e] border-emerald-900/60 text-emerald-400 hover:border-emerald-700' 
                : 'bg-[#0b0d13] border-[#1e2230] text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
            }`}
            title="Скопировать URL оверлея для Browser Source в OBS"
          >
            <Tv size={11} className={obsStatus.connected ? 'text-emerald-400' : 'text-zinc-600'} />
            <span>OBS: {obsStatus.connected ? `В СЕТИ (${obsStatus.count})` : 'ВЫКЛ'}</span>
            {copiedOverlay ? <Check size={10} className="text-emerald-400 ml-0.5" /> : <Copy size={9} className="opacity-50 ml-0.5" />}
          </div>

          {/* RE Engine Badge */}
          <div 
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#222634] bg-[#0c0e14] text-zinc-300 text-[10px] font-mono uppercase whitespace-nowrap flex-shrink-0"
            title="Связь REFramework и Resident Evil активна"
          >
            <Gamepad2 size={11} className="text-zinc-400" />
            <span>RE ENGINE</span>
          </div>
        </div>

        {/* Right: Volume Slider */}
        <div className="flex items-center gap-1.5 bg-[#090a0f] px-2 py-0.5 rounded border border-[#1c202d] flex-shrink-0">
          <Volume2 size={12} className="text-zinc-400" />
          <span className="text-[10px] uppercase font-bold text-zinc-400 whitespace-nowrap font-mono">ЗВУК:</span>
          <input 
            type="range" 
            min={0} 
            max={100} 
            value={masterVolume} 
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-14 accent-red-600 h-1 cursor-pointer bg-[#141620] rounded"
            title="Громкость диктора"
          />
          <span className="text-[10px] font-mono text-zinc-300 font-bold w-6 text-right">{masterVolume}%</span>
        </div>
      </div>

      {/* 2. FULL-WIDTH NAVIGATION TAB STRIP */}
      <div className="relative z-10 flex bg-[#0c0e14] border border-[#1e2332] rounded p-0.5 gap-1 flex-shrink-0">
        <button 
          className={`flex-1 py-1 px-2 text-[11px] font-mono uppercase font-bold tracking-wider rounded transition-all text-center ${
            activeTab === 'control' 
              ? 'bg-[#161925] text-zinc-100 border-b-2 border-red-600 shadow-sm' 
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#11131c]'
          }`}
          onClick={() => setActiveTab('control')}
        >
          [ ПУЛЬТ ]
        </button>
        <button 
          className={`flex-1 py-1 px-2 text-[11px] font-mono uppercase font-bold tracking-wider rounded transition-all text-center ${
            activeTab === 'twitch' 
              ? 'bg-[#161925] text-zinc-100 border-b-2 border-red-600 shadow-sm' 
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#11131c]'
          }`}
          onClick={() => setActiveTab('twitch')}
        >
          [ TWITCH ]
        </button>
        <button 
          className={`flex-1 py-1 px-2 text-[11px] font-mono uppercase font-bold tracking-wider rounded transition-all text-center ${
            activeTab === 'tiers' 
              ? 'bg-[#161925] text-zinc-100 border-b-2 border-red-600 shadow-sm' 
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#11131c]'
          }`}
          onClick={() => setActiveTab('tiers')}
        >
          [ ТИРЫ ]
        </button>
        <button 
          className={`flex-1 py-1 px-2 text-[11px] font-mono uppercase font-bold tracking-wider rounded transition-all text-center ${
            activeTab === 'debug' 
              ? 'bg-[#161925] text-zinc-100 border-b-2 border-red-600 shadow-sm' 
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#11131c]'
          }`}
          onClick={() => setActiveTab('debug')}
        >
          [ ТЕСТЫ ]
        </button>
        <button 
          className={`flex-1 py-1 px-2 text-[11px] font-mono uppercase font-bold tracking-wider rounded transition-all text-center ${
            activeTab === 'settings' 
              ? 'bg-[#161925] text-zinc-100 border-b-2 border-red-600 shadow-sm' 
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#11131c]'
          }`}
          onClick={() => setActiveTab('settings')}
        >
          [ ОПЦИИ ]
        </button>
      </div>

      {/* 3. MAIN CONTENT VIEWPORT */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
        
        {/* TAB 1: ПУЛЬТ (Operational Live Viewport - 2 columns) */}
        {activeTab === 'control' && (
          <div className="w-full h-full grid grid-cols-12 gap-2.5 overflow-hidden">
            {/* Left Column (38%): Operational controls */}
            <div className="col-span-5 flex flex-col gap-2 bg-[#0e1017] border border-[#1e2332] p-2.5 rounded h-full overflow-hidden justify-between">
              <div className="flex flex-col gap-2">
                {/* Mode Status Banner */}
                {streamMode === 'live' ? (
                  <div className="bg-red-950/20 border border-red-900/40 rounded p-2 text-red-300 flex items-start gap-2">
                    <Flame size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-red-400 uppercase text-[11px] font-mono">РЕЖИМ ПРЯМОГО ЭФИРА</div>
                      <div className="text-zinc-400 text-[10px] mt-0.5 leading-tight font-mono">
                        Интерактивные голосования активны для зрителей Twitch и донатов.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#13151f] border border-[#222636] rounded p-2 text-zinc-300 flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-zinc-400 flex-shrink-0 mt-1" />
                    <div>
                      <div className="font-bold text-zinc-300 uppercase text-[11px] font-mono">РЕЖИМ ПЕСОЧНИЦЫ</div>
                      <div className="text-zinc-400 text-[10px] mt-0.5 leading-tight font-mono">
                        Тестирование логики и симуляция зрителей без реального чата.
                      </div>
                    </div>
                  </div>
                )}

                {/* Launch Game Button */}
                <button
                  className="w-full bg-[#141722] hover:bg-[#1a1e2d] border border-[#262c3e] hover:border-red-900/60 text-zinc-200 text-xs uppercase font-mono font-bold py-2 rounded flex items-center justify-center gap-2 transition-all"
                  onClick={() => (window as any).api?.launchGame?.()}
                >
                  <Gamepad2 size={14} className="text-zinc-400" />
                  <span>ЗАПУСТИТЬ RESIDENT EVIL 2</span>
                </button>

                {/* Start / Stop Event Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="flex flex-col items-center justify-center gap-1 bg-[#141722] hover:bg-[#1c202f] text-zinc-200 border border-[#262c3e] hover:border-zinc-500 p-2 rounded transition-colors"
                    onClick={() => window.api?.startSimulator?.()}
                  >
                    <Play size={14} className="text-emerald-400" />
                    <span className="text-[10px] uppercase font-mono font-bold whitespace-nowrap">Старт раунда</span>
                  </button>
                  <button
                    className="flex flex-col items-center justify-center gap-1 bg-[#141722] hover:bg-red-950/40 text-zinc-200 hover:text-red-300 border border-[#262c3e] hover:border-red-800/60 p-2 rounded transition-colors"
                    onClick={() => window.api?.stopSimulator?.()}
                  >
                    <Square size={14} className="text-red-500" />
                    <span className="text-[10px] uppercase font-mono font-bold whitespace-nowrap">Остановить</span>
                  </button>
                </div>

                {/* Traitor Button */}
                <button
                  className={`w-full flex items-center justify-center gap-2 py-2 px-2.5 border rounded text-xs font-mono font-bold transition-all ${
                    (trustedCount > 0 && !traitorState?.active)
                      ? 'bg-red-950/40 hover:bg-red-900/60 text-red-200 border-red-800/70 shadow-[0_0_10px_rgba(220,38,38,0.2)]' 
                      : 'bg-[#101218] border-[#1e222e] text-zinc-600 cursor-not-allowed'
                  }`}
                  onClick={() => window.api?.invokeTraitor?.()}
                  disabled={trustedCount === 0 || traitorState?.active}
                >
                  <Skull size={14} className={trustedCount > 0 && !traitorState?.active ? "text-red-400" : "text-zinc-600"} />
                  <span className="uppercase tracking-wider whitespace-nowrap">ВЫЗВАТЬ ПРЕДАТЕЛЯ</span>
                  {trustedCount > 0 && (
                    <span className="bg-[#0a0c10] text-red-300 text-[10px] px-1.5 py-0.2 rounded border border-red-900/50">
                      {trustedCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Pacing Cooldown */}
              <div className="border-t border-[#1e2332] pt-2">
                <label className="text-[10px] font-bold font-mono text-zinc-400 uppercase mb-1 flex items-center gap-1">
                  <Clock size={11} /> Кулдаун между голосованиями
                </label>
                <select 
                  className="w-full bg-[#090a0f] border border-[#222634] text-zinc-200 text-xs p-1.5 rounded outline-none cursor-pointer font-mono"
                  onChange={(e) => window.api?.updateSettings?.({ cooldownMs: parseInt(e.target.value) })}
                  defaultValue="600000"
                >
                  <option value="60000">1 минута (Тест)</option>
                  <option value="300000">5 минут</option>
                  <option value="600000">10 минут (По умолчанию)</option>
                  <option value="900000">15 минут</option>
                  <option value="1200000">20 минут</option>
                </select>
              </div>
            </div>

            {/* Right Column (62%): Observation viewport (Voting, Karma, Logs) */}
            <div className="col-span-7 h-full flex flex-col gap-2 overflow-hidden">
              {/* Voting or Cooldown widget */}
              <div className="h-[30%] flex-shrink-0">
                {renderVotingUI()}
              </div>

              {/* Bottom Monitoring (Karma 35% + Logs 65%) */}
              <div className="h-[70%] flex gap-2 min-h-0">
                {/* Top Karma */}
                <div className="w-[35%] bg-[#0e1017] border border-[#1e2332] p-2 rounded text-xs font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
                  <h3 className="text-zinc-300 font-bold font-mono mb-1.5 border-b border-[#1e2332] pb-1 text-center text-[10px] uppercase tracking-wider flex-shrink-0">
                    ТОП КАРМЫ ЗРИТЕЛЕЙ
                  </h3>
                  <div className="overflow-y-auto flex-1 custom-scrollbar min-h-0 pr-1">
                    {(!leaderboard || leaderboard.length === 0) ? (
                      <div className="text-zinc-600 text-center text-[10px] py-4">Нет данных...</div>
                    ) : (
                      leaderboard.map((viewer, idx) => (
                        <div key={viewer?.username || idx} className="flex justify-between items-center mb-1 text-[10px]">
                          <span className="text-zinc-400 truncate pr-1">{idx + 1}. {viewer?.username}</span>
                          <span className="text-red-300 font-bold bg-[#141722] px-1 py-0.2 border border-[#222634] rounded-sm">
                            {viewer?.karma}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* System Logs */}
                <div className="w-[65%] bg-[#0e1017] border border-[#1e2332] p-2 rounded text-xs font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[#1e2332] pb-1 mb-1 flex-shrink-0">
                    <h3 className="text-zinc-300 font-bold text-[10px] uppercase tracking-wider font-mono">
                      ЖУРНАЛ СОБЫТИЙ
                    </h3>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setLogFilter('all')}
                        className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase transition-colors ${logFilter === 'all' ? 'bg-red-950/60 text-red-300 border border-red-800/60' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Все
                      </button>
                      <button 
                        onClick={() => setLogFilter('system')}
                        className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase transition-colors ${logFilter === 'system' ? 'bg-red-950/60 text-red-300 border border-red-800/60' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        События
                      </button>
                      <button 
                        onClick={() => setLogFilter('chat')}
                        className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase transition-colors ${logFilter === 'chat' ? 'bg-red-950/60 text-red-300 border border-red-800/60' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Чат
                      </button>
                      <button 
                        onClick={() => setLogs([])}
                        className="ml-1 text-zinc-500 hover:text-red-400 p-0.5 transition-colors"
                        title="Очистить журнал"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-1 text-xs font-mono">
                    {(filteredLogs || []).map((log, index) => (
                      <div key={index} className="mb-1 break-all border-b border-[#181b26] pb-0.5 flex flex-col gap-0.5">
                        <div className="text-[9px] text-zinc-600">{log.timestamp}</div>
                        <div className="flex items-start text-[10px]">
                          {log?.type === 'system' ? (
                            <span className="text-red-400 font-bold">{log?.message}</span>
                          ) : (
                            <>
                              <span className="text-zinc-500 mr-1">&gt;</span>
                              <span className="text-zinc-400">{log?.username}: </span>
                              <span className="ml-1 text-zinc-200 font-bold">{log?.command}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TWITCH (Full-Width Dedicated Bot Console) */}
        {activeTab === 'twitch' && (
          <div className="w-full h-full flex flex-col gap-2.5 overflow-hidden">
            {/* Top Status Strip */}
            <div className="flex items-center justify-between bg-[#0e1017] border border-[#1e2332] p-2.5 rounded flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-red-950/40 border border-red-800/60 flex items-center justify-center text-red-400">
                  <Bot size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-100 tracking-wider uppercase flex items-center gap-2">
                    КОНСОЛЬ УПРАВЛЕНИЯ UMBRELLACORP_BOT
                    <span className="text-[9px] bg-red-950/80 text-red-400 border border-red-800/80 px-1.5 py-0.2 rounded font-mono font-bold">
                      DEDICATED BOT
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Сервисный агент интерактивного чата. Личный аккаунт стримера полностью защищён.
                  </p>
                </div>
              </div>

              {/* Live Status Indicators */}
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded border text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                  twitchStatus.connected 
                    ? 'bg-[#0a120e] border-emerald-900/60 text-emerald-400' 
                    : 'bg-[#10121a] border-[#222533] text-zinc-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${twitchStatus.connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                  <span>{twitchStatus.connected ? `СВЯЗЬ: #${twitchStatus.channel}` : 'СВЯЗЬ: ОТКЛЮЧЕН'}</span>
                </div>

                {twitchStatus.connected && (
                  twitchStatus.isMod ? (
                    <div className="px-2 py-1 rounded border text-[10px] font-mono font-bold flex items-center gap-1 bg-[#0a120e] border-emerald-900/60 text-emerald-400">
                      <ShieldCheck size={12} />
                      <span>МОДЕРАТОР ✓</span>
                    </div>
                  ) : (
                    <div className="px-2 py-1 rounded border text-[10px] font-mono font-bold flex items-center gap-1 bg-amber-950/30 border-amber-800/60 text-amber-400">
                      <AlertTriangle size={12} />
                      <span>НЕТ ПРАВ (/MOD)</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Main Configuration Grid (2 Columns, 50% / 50%) */}
            <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0 overflow-hidden">
              {/* Left Column: Channel & Moderator Rights */}
              <div className="flex flex-col gap-2.5 bg-[#0e1017] border border-[#1e2332] p-3 rounded overflow-hidden justify-between">
                <div className="flex flex-col gap-3">
                  {/* Step 1: Moderator Command */}
                  <div className="flex flex-col gap-1.5 border-b border-[#1e2332] pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-red-400 uppercase flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded bg-red-950/60 border border-red-800/80 flex items-center justify-center text-[10px] text-red-300">1</span>
                        ПРАВА МОДЕРАТОРА ДЛЯ БОТА
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase">Обязательно</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                      Для отправки результатов голосований без задержек и лимитов антиспама боту нужны права модератора на канале стримера.
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-[#08090d] border border-[#222634] text-zinc-200 px-2.5 py-1.5 rounded font-mono text-xs font-bold select-all truncate">
                        /mod {botUsername.trim() || 'UmbrellaCorp_Bot'}
                      </div>
                      <button
                        onClick={copyModCommand}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono font-bold transition-all whitespace-nowrap ${
                          copiedModCommand 
                            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                            : 'bg-[#141722] hover:bg-[#1a1e2d] border-[#262c3e] text-zinc-200'
                        }`}
                      >
                        {copiedModCommand ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copiedModCommand ? 'СКОПИРОВАНО' : 'СКОПИРОВАТЬ'}</span>
                      </button>
                    </div>
                    <span className="text-[9px] text-zinc-600 font-mono mt-0.5">
                      Отправьте эту команду в чате вашего канала один раз.
                    </span>
                  </div>

                  {/* Step 2: Channel Name */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-red-400 uppercase flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded bg-red-950/60 border border-red-800/80 flex items-center justify-center text-[10px] text-red-300">2</span>
                        КАНАЛ ТРАНСЛЯЦИИ СТРИМЕРА
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                      Укажите Twitch-канал, где бот будет считывать голоса зрителей.
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          placeholder="например: bratishkinoff, shroud, lirik" 
                          className="w-full bg-[#08090d] border border-[#222634] focus:border-red-600/70 text-zinc-100 px-3 py-1.5 font-mono text-xs rounded outline-none transition-colors"
                          value={twitchChannel}
                          onChange={(e) => setTwitchChannel(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Note */}
                <div className="bg-[#090a0f] border border-[#1b1e2a] p-2 rounded text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                  <ShieldCheck size={16} className="text-zinc-400 flex-shrink-0" />
                  <span>Личный токен стримера не запрашивается. Полная безопасность и изоляция учетной записи.</span>
                </div>
              </div>

              {/* Right Column: Bot Account Authorization */}
              <div className="flex flex-col gap-2.5 bg-[#0e1017] border border-[#1e2332] p-3 rounded overflow-hidden justify-between">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-[#1e2332] pb-2">
                    <span className="text-[11px] font-mono font-bold text-red-400 uppercase flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded bg-red-950/60 border border-red-800/80 flex items-center justify-center text-[10px] text-red-300">3</span>
                      АВТОРИЗАЦИЯ И СВЯЗЬ БОТА
                    </span>
                    <a
                      href="https://twitchtokengenerator.com/quick/chat"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 underline transition-colors"
                    >
                      Генератор токена <ExternalLink size={10} />
                    </a>
                  </div>

                  {/* Bot Username */}
                  <div>
                    <label className="block text-zinc-400 text-[10px] font-mono uppercase mb-1">
                      Имя сервисного аккаунта бота (Twitch Login)
                    </label>
                    <input 
                      type="text" 
                      className="w-full bg-[#08090d] border border-[#222634] focus:border-red-600/70 text-zinc-100 px-3 py-1.5 font-mono text-xs rounded outline-none transition-colors"
                      value={botUsername}
                      onChange={(e) => setBotUsername(e.target.value)}
                      placeholder="UmbrellaCorp_Bot"
                    />
                  </div>

                  {/* Bot OAuth Token */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-zinc-400 text-[10px] font-mono uppercase">
                        OAuth-токен чата бота
                      </label>
                      <div className="flex items-center gap-1.5">
                        {tokenStatus === 'valid' && (
                          <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                            <CheckCircle2 size={10} /> ВАЛИДНЫЙ ФОРМАТ
                          </span>
                        )}
                        {tokenStatus === 'invalid' && (
                          <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5">
                            <XCircle size={10} /> ТРЕБУЕТСЯ oauth:...
                          </span>
                        )}
                        {tokenStatus === 'validating' && (
                          <span className="text-[9px] text-amber-400 font-bold flex items-center gap-0.5">
                            <Loader2 size={10} className="animate-spin" /> ПРОВЕРКА
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative flex items-center">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="w-full bg-[#08090d] border border-[#222634] focus:border-red-600/70 text-zinc-100 px-3 py-1.5 pr-8 font-mono text-xs rounded outline-none transition-colors"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        onFocus={() => {
                          if (botToken.includes('••••')) {
                            setBotToken('')
                          }
                        }}
                        placeholder={botToken.includes('••••') ? 'Токен зашифрован в DPAPI (введите новый для смены)' : 'oauth:xxxxxxxxxxxxxxxxxxxx'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <span className="text-[9px] text-zinc-600 font-mono mt-0.5 block">
                      Токен шифруется аппаратно через Windows DPAPI.
                    </span>
                  </div>

                  {/* Ping Feedback Banner */}
                  {pingMessage && (
                    <div className={`text-[10px] font-mono p-2 rounded border text-center ${
                      pingStatus === 'success' 
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' 
                        : 'bg-red-950/30 border-red-800/50 text-red-300'
                    }`}>
                      {pingMessage}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e2332]">
                  {!twitchStatus?.connected ? (
                    <button
                      className="col-span-2 flex items-center justify-center gap-2 bg-red-950/50 hover:bg-red-900/70 text-red-200 font-mono font-bold py-2 px-3 border border-red-800/80 rounded text-xs transition-all shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                      onClick={() => {
                        if (window.api?.saveTwitchAuth) {
                          window.api.saveTwitchAuth(botUsername, botToken, twitchChannel)
                        }
                        window.api?.connectTwitch?.(twitchChannel)
                      }}
                    >
                      <Zap size={14} className="text-red-400" />
                      <span>АКТИВИРОВАТЬ UMBRELLACORP_BOT</span>
                    </button>
                  ) : (
                    <>
                      <button
                        className="flex items-center justify-center gap-2 bg-[#141722] hover:bg-[#1c202e] text-zinc-300 font-mono font-bold py-1.5 px-3 border border-[#262c3e] rounded text-xs transition-colors"
                        onClick={() => window.api?.disconnectTwitch?.()}
                      >
                        ОТКЛЮЧИТЬ
                      </button>

                      <button
                        disabled={pingStatus === 'sending'}
                        className="flex items-center justify-center gap-2 bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-800/70 font-mono font-bold py-1.5 px-3 rounded text-xs transition-colors disabled:opacity-50"
                        onClick={handleSendTestPing}
                        title="Отправить тестовое сообщение от имени бота в чат"
                      >
                        {pingStatus === 'sending' ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        <span>{pingStatus === 'sending' ? 'ОТПРАВКА...' : 'ПРОВЕРИТЬ СВЯЗЬ'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ТИРЫ (Full-Width Tiers Configurator) */}
        {activeTab === 'tiers' && (
          <div className="w-full h-full">
            <TiersConfigurator embedded={true} />
          </div>
        )}

        {/* TAB 4: ТЕСТЫ (Full-Width Test Lab) */}
        {activeTab === 'debug' && (
          <div className="w-full h-full flex gap-3 overflow-hidden">
            {/* Left Box (42%): Mobile Remote (Stream Deck) */}
            <div className="w-[42%] bg-[#0e1017] border border-[#1e2332] p-3 rounded text-xs shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden">
              <div>
                <div className="flex items-center justify-between border-b border-[#1e2332] pb-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200 uppercase font-mono">
                    <Smartphone size={14} className="text-zinc-400" />
                    <span>МОБИЛЬНЫЙ ПУЛЬТ STREAM DECK</span>
                  </div>
                  {remoteInfo && (
                    <span className="text-[10px] font-mono text-zinc-300 bg-[#141722] px-2 py-0.5 rounded border border-[#222634]">
                      {remoteInfo.clients > 0 ? `🟢 ${remoteInfo.clients} В СЕТИ` : '⚪ ОЖИДАНИЕ'}
                    </span>
                  )}
                </div>

                <div className="flex gap-3 items-center">
                  {remoteInfo?.qr ? (
                    <div className="bg-white p-1.5 rounded shadow flex-shrink-0">
                      <img 
                        src={remoteInfo.qr} 
                        alt="QR Код" 
                        className="w-[96px] h-[96px] block" 
                      />
                    </div>
                  ) : (
                    <div className="w-[96px] h-[96px] bg-[#12141c] border border-[#222634] rounded flex items-center justify-center flex-shrink-0">
                      <QrCode size={28} className="text-zinc-600 animate-pulse" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col gap-1.5 text-[10px] text-zinc-400 leading-normal font-mono">
                    <div>
                      Наведите камеру смартфона на QR-код для подключения пульта управления.
                    </div>
                    <div className="text-red-400 font-mono text-[10px]">
                      Управляйте эффектами прямо со смартфона без альтаба и паузы игры!
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#1e2332]">
                <input 
                  readOnly 
                  value={remoteInfo?.url || 'http://127.0.0.1:27016/remote'} 
                  className="bg-[#08090d] border border-[#222634] text-[10px] text-zinc-300 px-2 py-1.5 rounded font-mono flex-1 truncate select-all outline-none"
                />
                <button
                  onClick={() => {
                    if (remoteInfo?.url) {
                      navigator.clipboard.writeText(remoteInfo.url)
                      setCopiedRemote(true)
                      setTimeout(() => setCopiedRemote(false), 2000)
                    }
                  }}
                  className="bg-[#141722] hover:bg-[#1a1e2d] border border-[#262c3e] text-zinc-300 p-1.5 rounded transition-colors"
                  title="Скопировать ссылку"
                >
                  {copiedRemote ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <button
                  onClick={() => {
                    if (remoteInfo?.url) {
                      window.open(remoteInfo.url, '_blank')
                    }
                  }}
                  className="bg-[#141722] hover:bg-[#1a1e2d] border border-[#262c3e] text-zinc-300 p-1.5 rounded transition-colors"
                  title="Открыть в браузере ПК"
                >
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>

            {/* Right Box (58%): Tactical Quick Triggers */}
            <div className="w-[58%] bg-[#0e1017] border border-[#1e2332] p-3 rounded text-xs font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#1e2332] pb-2 mb-2 flex-shrink-0">
                <h3 className="text-zinc-200 font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={14} className="text-red-400" />
                  <span>ТАКТИЧЕСКИЙ ПОЛИГОН ЭФФЕКТОВ</span>
                </h3>
                <span className="text-[10px] text-zinc-500 uppercase">Мгновенное исполнение в RE2</span>
              </div>

              <div className="grid grid-cols-2 gap-2 flex-1">
                <button
                  className="bg-[#12141c] hover:bg-[#181a24] border border-[#242838] hover:border-red-900/60 text-zinc-200 text-xs font-mono font-bold py-2.5 px-3 rounded flex items-center justify-between transition-all"
                  onClick={async () => {
                    await window.api?.triggerEffect?.('empty_mag')
                    setTestSuccessEffect('empty_mag')
                    setTimeout(() => setTestSuccessEffect(null), 1500)
                  }}
                >
                  <span className="truncate">ОСЕЧКА [EMPTY_MAG]</span>
                  {testSuccessEffect === 'empty_mag' ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <Zap size={13} className="text-zinc-500 flex-shrink-0" />}
                </button>

                <button
                  className="bg-[#12141c] hover:bg-[#181a24] border border-[#242838] hover:border-red-900/60 text-zinc-200 text-xs font-mono font-bold py-2.5 px-3 rounded flex items-center justify-between transition-all"
                  onClick={async () => {
                    await window.api?.triggerEffect?.('hop')
                    setTestSuccessEffect('hop')
                    setTimeout(() => setTestSuccessEffect(null), 1500)
                  }}
                >
                  <span className="truncate">ПОДСКОК [HOP]</span>
                  {testSuccessEffect === 'hop' ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <Zap size={13} className="text-zinc-500 flex-shrink-0" />}
                </button>

                <button
                  className="bg-[#12141c] hover:bg-[#181a24] border border-[#242838] hover:border-red-900/60 text-zinc-200 text-xs font-mono font-bold py-2.5 px-3 rounded flex items-center justify-between transition-all"
                  onClick={async () => {
                    await window.api?.triggerEffect?.('push_back')
                    setTestSuccessEffect('push_back')
                    setTimeout(() => setTestSuccessEffect(null), 1500)
                  }}
                >
                  <span className="truncate">ВЕТЕРОК [PUSH_BACK]</span>
                  {testSuccessEffect === 'push_back' ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <Zap size={13} className="text-zinc-500 flex-shrink-0" />}
                </button>

                <button
                  className="bg-[#12141c] hover:bg-[#181a24] border border-[#242838] hover:border-red-900/60 text-zinc-200 text-xs font-mono font-bold py-2.5 px-3 rounded flex items-center justify-between transition-all"
                  onClick={async () => {
                    await window.api?.triggerEffect?.('heal_small')
                    setTestSuccessEffect('heal_small')
                    setTimeout(() => setTestSuccessEffect(null), 1500)
                  }}
                >
                  <span className="truncate">ХИЛ (+25% HP)</span>
                  {testSuccessEffect === 'heal_small' ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <Zap size={13} className="text-zinc-500 flex-shrink-0" />}
                </button>

                <button
                  className="bg-[#12141c] hover:bg-[#181a24] border border-[#242838] hover:border-red-900/60 text-zinc-200 text-xs font-mono font-bold py-2.5 px-3 rounded flex items-center justify-between transition-all"
                  onClick={async () => {
                    await window.api?.triggerEffect?.('speed_up')
                    setTestSuccessEffect('speed_up')
                    setTimeout(() => setTestSuccessEffect(null), 1500)
                  }}
                >
                  <span className="truncate">АДРЕНАЛИН [SPEED_UP]</span>
                  {testSuccessEffect === 'speed_up' ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <Zap size={13} className="text-zinc-500 flex-shrink-0" />}
                </button>

                <button
                  className="bg-[#12141c] hover:bg-[#181a24] border border-[#242838] hover:border-red-900/60 text-zinc-200 text-xs font-mono font-bold py-2.5 px-3 rounded flex items-center justify-between transition-all"
                  onClick={async () => {
                    await window.api?.triggerEffect?.('papercut')
                    setTestSuccessEffect('papercut')
                    setTimeout(() => setTestSuccessEffect(null), 1500)
                  }}
                >
                  <span className="truncate">ЦАРАПИНА (-10% HP)</span>
                  {testSuccessEffect === 'papercut' ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <Zap size={13} className="text-zinc-500 flex-shrink-0" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ОПЦИИ (Full-Width Settings) */}
        {activeTab === 'settings' && (
          <div className="w-full h-full grid grid-cols-2 gap-3 overflow-hidden">
            {/* Left Card: Hotkeys + Director */}
            <div className="bg-[#0e1017] border border-[#1e2332] p-3 rounded flex flex-col justify-between overflow-hidden">
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs font-bold text-zinc-100 uppercase font-mono border-b border-[#1e2332] pb-2 flex items-center gap-2">
                  <span>ГЛОБАЛЬНЫЕ ГОРЯЧИЕ КЛАВИШИ</span>
                </h3>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">
                      Клавиша вызова: Режим Предателя
                    </label>
                    <input
                      type="text"
                      className="w-full bg-[#08090d] border border-[#222634] focus:border-red-600/70 text-zinc-100 px-3 py-1.5 font-mono text-xs rounded outline-none transition-colors"
                      value={hotkeys.traitor}
                      onChange={(e) => setHotkeys({ ...hotkeys, traitor: e.target.value })}
                      placeholder="например: num1, F1"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">
                      Клавиша вызова: Вмешательство Амбреллы
                    </label>
                    <input
                      type="text"
                      className="w-full bg-[#08090d] border border-[#222634] focus:border-red-600/70 text-zinc-100 px-3 py-1.5 font-mono text-xs rounded outline-none transition-colors"
                      value={hotkeys.intervention}
                      onChange={(e) => setHotkeys({ ...hotkeys, intervention: e.target.value })}
                      placeholder="например: num2, F2"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">
                      Клавиша вызова: АВАРИЙНАЯ ОСТАНОВКА (Сброс всех эффектов)
                    </label>
                    <input
                      type="text"
                      className="w-full bg-[#08090d] border border-[#222634] focus:border-red-600/70 text-zinc-100 px-3 py-1.5 font-mono text-xs rounded outline-none transition-colors"
                      value={hotkeys.panic}
                      onChange={(e) => setHotkeys({ ...hotkeys, panic: e.target.value })}
                      placeholder="например: CommandOrControl+Shift+P"
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    Поддерживаются: num0-num9, numdec, F1-F24, Control+Shift+T и др.
                  </div>
                </div>

                <h3 className="text-xs font-bold text-cyan-300 uppercase font-mono border-b border-[#1e2332] pb-2 pt-2 flex items-center gap-2">
                  <span>ДИРЕКТОР ИВЕНТА (ADAPTIVE PACING)</span>
                </h3>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[10px] text-zinc-300 font-bold uppercase cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-cyan-500"
                      checked={director.enabled}
                      onChange={(e) => setDirector({ ...director, enabled: e.target.checked })}
                    />
                    Включить адаптивный пейсинг
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-400 text-[9px] font-bold uppercase mb-1">
                        Милосердие: серий негативов
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        className="w-full bg-[#08090d] border border-[#222634] focus:border-cyan-600/70 text-zinc-100 px-2 py-1.5 font-mono text-xs rounded outline-none"
                        value={director.mercyStreak}
                        onChange={(e) => setDirector({ ...director, mercyStreak: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[9px] font-bold uppercase mb-1">
                        Кулдаун побед (раундов)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        className="w-full bg-[#08090d] border border-[#222634] focus:border-cyan-600/70 text-zinc-100 px-2 py-1.5 font-mono text-xs rounded outline-none"
                        value={director.winnerCooldownRounds}
                        onChange={(e) => setDirector({ ...director, winnerCooldownRounds: Math.max(0, parseInt(e.target.value) || 0) })}
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[9px] font-bold uppercase mb-1">
                        Порог тишины чата (0-1)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full bg-[#08090d] border border-[#222634] focus:border-cyan-600/70 text-zinc-100 px-2 py-1.5 font-mono text-xs rounded outline-none"
                        value={director.lowEngagementThreshold}
                        onChange={(e) => setDirector({ ...director, lowEngagementThreshold: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0.25)) })}
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[9px] font-bold uppercase mb-1">
                        Шанс интервенции в тишине (0-1)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full bg-[#08090d] border border-[#222634] focus:border-cyan-600/70 text-zinc-100 px-2 py-1.5 font-mono text-xs rounded outline-none"
                        value={director.quietInterventionChance}
                        onChange={(e) => setDirector({ ...director, quietInterventionChance: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0.6)) })}
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[9px] font-bold uppercase mb-1">
                        Шанс босс-раунда (0-1)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full bg-[#08090d] border border-[#222634] focus:border-cyan-600/70 text-zinc-100 px-2 py-1.5 font-mono text-xs rounded outline-none"
                        value={director.bossRoundChance}
                        onChange={(e) => setDirector({ ...director, bossRoundChance: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) })}
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[9px] font-bold uppercase mb-1">
                        Порог явки босс-раунда
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        className="w-full bg-[#08090d] border border-[#222634] focus:border-cyan-600/70 text-zinc-100 px-2 py-1.5 font-mono text-xs rounded outline-none"
                        value={director.bossThreshold}
                        onChange={(e) => setDirector({ ...director, bossThreshold: Math.max(1, parseInt(e.target.value) || 12) })}
                      />
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-500 font-mono leading-relaxed">
                    Директор следит за вовлечённостью и балансом: в тихом чате повышает шанс вмешательства, после серии негативных побед подмешивает позитив, а недавние победители временно исключаются из пула. Босс-раунд даёт тройку жёстких эффектов: они срабатывают только если суммарная явка достигла порога — иначе чат проваливает раунд.
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-3">
                <button
                  className="w-full bg-red-950/40 hover:bg-red-900/60 border border-red-800/70 text-red-200 text-xs uppercase font-mono font-bold py-2 rounded transition-colors whitespace-nowrap shadow-[0_0_10px_rgba(220,38,38,0.15)]"
                  onClick={() => window.api?.saveHotkeys?.(hotkeys)}
                >
                  СОХРАНИТЬ ГОРЯЧИЕ КЛАВИШИ
                </button>
                <button
                  className="w-full bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/70 text-cyan-200 text-xs uppercase font-mono font-bold py-2 rounded transition-colors whitespace-nowrap"
                  onClick={() => window.api?.saveDirectorConfig?.(director)}
                >
                  СОХРАНИТЬ ДИРЕКТОРА
                </button>
                <button
                  className="w-full bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/70 text-emerald-200 text-xs uppercase font-mono font-bold py-2 rounded transition-colors whitespace-nowrap"
                  onClick={async () => {
                    const report = await window.api?.publishReport?.()
                    if (report?.text) {
                      try { await navigator.clipboard.writeText(report.text) } catch {}
                    }
                  }}
                >
                  ОПУБЛИКОВАТЬ ИТОГИ СТРИМА
                </button>
                <div className="flex gap-2">
                  <button
                    className="flex-1 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] uppercase font-mono font-bold py-1.5 rounded transition-colors"
                    onClick={() => window.api?.resetSession?.()}
                  >
                    НОВЫЙ СТРИМ
                  </button>
                  <button
                    className="flex-1 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] uppercase font-mono font-bold py-1.5 rounded transition-colors"
                    onClick={async () => {
                      const r = await window.api?.testObsMarker?.()
                      setObsMarkerStatus(r?.ok ? 'Маркер отправлен' : r?.connected ? 'OBS подключён, но запись выключена' : 'OBS не подключён')
                    }}
                  >
                    ТЕСТ МАРКЕРА OBS
                  </button>
                </div>
                {obsMarkerStatus && (
                  <div className="text-[10px] font-mono text-amber-300">{obsMarkerStatus}</div>
                )}
              </div>
            </div>

            {/* Right Card: Dangerous Zone & Maintenance */}
            <div className="bg-[#0e1017] border border-[#1e2332] p-3 rounded flex flex-col justify-between overflow-hidden">
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs font-bold text-red-400 uppercase font-mono border-b border-[#1e2332] pb-2">
                  СЛУЖЕБНЫЕ ОПЦИИ И ОПАСНАЯ ЗОНА
                </h3>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                  Переустановка скриптов REFramework восстанавливает файлы Lua-моста (`effects.lua`, `recontrol_server.lua`) и сбрасывает сетевые порты на значения по умолчанию.
                </p>
                <div className="bg-[#090a0f] border border-[#1c1f2b] p-2 rounded text-[10px] text-zinc-500 font-mono flex flex-col gap-1">
                  <div>Целевая платформа: Resident Evil 2 Remake</div>
                  <div>Протокол связи: IPC WebSocket + Memory Mapped Files</div>
                  <div>Порт веб-сервера: 27016</div>
                </div>

                <h3 className="text-xs font-bold text-amber-300 uppercase font-mono border-b border-[#1e2332] pb-2 pt-1">
                  СИНТЕЗ РЕЧИ (TTS-ФОЛБЭК)
                </h3>
                <label className="flex items-center gap-2 text-[10px] text-zinc-300 font-bold uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-amber-500"
                    checked={ttsConfig.enabled}
                    onChange={(e) => {
                      const patch = { ...ttsConfig, enabled: e.target.checked }
                      setTtsConfig(patch)
                      window.api?.setTtsConfig?.(patch)
                    }}
                  />
                  Озвучивать реплики при отсутствии актёрских файлов
                </label>
                <div className="text-[9px] text-zinc-500 font-mono leading-relaxed">
                  Использует Edge TTS (ru-RU, нейро-голоса Microsoft) при наличии Python + пакета edge-tts.
                  Если актёрская запись найдена в assets/audio — играет она, TTS не используется.
                  Сгенерированные реплики кэшируются и работают офлайн.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="flex-1 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/70 text-amber-200 text-[10px] uppercase font-mono font-bold py-1.5 rounded transition-colors"
                    onClick={async () => {
                      const status = await window.api?.getTtsStatus?.()
                      setTtsStatus(status ?? null)
                    }}
                  >
                    ПРОВЕРИТЬ ДОСТУПНОСТЬ
                  </button>
                  <button
                    className="flex-1 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/70 text-amber-200 text-[10px] uppercase font-mono font-bold py-1.5 rounded transition-colors"
                    onClick={async () => {
                      const res = await window.api?.warmTtsCache?.()
                      if (res) setTtsWarm(`${res.generated}/${res.total}`)
                    }}
                  >
                    ПРОГРЕТЬ КЭШ
                  </button>
                </div>
                {ttsStatus && (
                  <div className={`text-[10px] font-mono ${ttsStatus.available ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ttsStatus.available ? '✔ edge-tts доступен' : '✖ edge-tts не найден (нужен Python + pip install edge-tts)'}
                  </div>
                )}
                {ttsWarm && (
                  <div className="text-[10px] font-mono text-amber-300">Кэш: {ttsWarm} реплик готово</div>
                )}
              </div>

              <button
                className="w-full bg-red-950/20 hover:bg-red-900/40 border border-red-900/50 hover:border-red-700/80 text-red-400 hover:text-red-300 text-xs uppercase font-mono font-bold py-2 rounded transition-colors whitespace-nowrap"
                onClick={() => onReinstall && onReinstall()}
              >
                ПЕРЕУСТАНОВИТЬ МОСТ REFRAMEWORK
              </button>
            </div>
          </div>
        )}

      </div>

      <AnimatePresence>
        {showTester && <VoiceTester onClose={() => setShowTester(false)} />}
      </AnimatePresence>
    </div>
  )
}
