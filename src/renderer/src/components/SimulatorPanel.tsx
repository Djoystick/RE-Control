import React, { useState, useEffect, useRef } from 'react'
import { Play, Square, Clock, Skull, Loader2, Radio, CheckCircle2, XCircle, Radar, Volume2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TiersConfigurator } from './TiersConfigurator'
import { VoiceTester } from './VoiceTester'

export const SimulatorPanel: React.FC<{ onReinstall?: () => void }> = ({ onReinstall }) => {
  const [logs, setLogs] = useState<any[]>([ { type: 'system', message: 'RE:CONTROL BRIDGE INITIALIZED', timestamp: new Date().toLocaleTimeString() } ])
  const [voteState, setVoteState] = useState<any>(null)
  const [twitchChannel, setTwitchChannel] = useState<string>('')
  const [twitchStatus, setTwitchStatus] = useState<{connected: boolean, channel: string, botAuthenticated?: boolean}>({connected: false, channel: ''})
  const [lastWinner, setLastWinner] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  
  const [traitorState, setTraitorState] = useState<any>(null)
  const [trustedCount, setTrustedCount] = useState<number>(0)
  const [showTester, setShowTester] = useState<boolean>(false)
  
  // Token validation state
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');

  // Tab and Bot Settings state
  const [activeTab, setActiveTab] = useState<'control' | 'twitch' | 'tiers' | 'debug' | 'settings'>('control')
  
  const [botUsername, setBotUsername] = useState<string>('')
  const [botToken, setBotToken] = useState<string>('')

  const [hotkeys, setHotkeys] = useState({ traitor: '', intervention: '' })

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
      if (h) setHotkeys(h);
    });

    if (window.api) {
      const handleSimulatorLog = (cmd: any) => {
        setLogs((prev) => [...prev, { ...cmd, timestamp: new Date().toLocaleTimeString() }].slice(-100))
      }
      
      const handleSimulatorSyslog = (sys: any) => {
        if (sys?.message?.startsWith('WINNER:')) setLastWinner(sys?.message?.replace('WINNER: ', ''));
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

      window.api.onSimulatorLog?.(handleSimulatorLog)
      window.api.onSimulatorSyslog?.(handleSimulatorSyslog)
      window.api.onVoteUpdate?.(handleVoteUpdate)
      window.api.onTwitchStatus?.(handleTwitchStatus)
      window.api.onTraitorStart?.(handleTraitorStart)
      window.api.onTraitorEnd?.(handleTraitorEnd)
      window.api.onTrustedCount?.(handleTrustedCount)

      window.api.updateSettings?.({ cooldownMs: 600000 })
      
      // Load initial twitch auth if available
      if (window.api.getTwitchAuth) {
        window.api.getTwitchAuth().then((auth: any) => {
          if (auth) {
            setBotUsername(auth.username || '')
            setBotToken(auth.token || '')
            if (auth.channel) setTwitchChannel(auth.channel)
          }
        })
      }

      return () => {
        if (window.api.removeListener) {
          window.api.removeListener('simulator-log', handleSimulatorLog)
          window.api.removeListener('simulator-syslog', handleSimulatorSyslog)
          window.api.removeListener('vote-update', handleVoteUpdate)
          window.api.removeListener('twitch-status', handleTwitchStatus)
          window.api.removeListener('traitor-start', handleTraitorStart)
          window.api.removeListener('traitor-end', handleTraitorEnd)
          window.api.removeListener('trusted-count', handleTrustedCount)
        }
      }
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

  const renderVotingUI = () => {
    if (traitorState?.active) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-pixel-danger/20 border border-pixel-danger p-3 rounded relative overflow-hidden flex flex-col h-full shadow-[0_0_15px_rgba(220,38,38,0.5)]"
        >
          <div className="flex justify-between items-center mb-2 border-b border-pixel-danger/50 pb-1">
            <div className="text-pixel-danger font-bold flex items-center gap-2 text-sm">
              <Skull className="animate-pulse" size={16} /> TRAITOR MODE
            </div>
            <div className="text-pixel-light font-mono font-bold text-sm">
              {Math.ceil((traitorState.timeRemainingMs || 0) / 1000)}s
            </div>
          </div>
          <div className="text-center mb-2">
            <h3 className="text-pixel-light font-bold text-sm uppercase ">
              💀 ПРЕДАТЕЛЬ <span className="text-pixel-amber">@{traitorState.username || 'UNKNOWN'}</span> ПОЛУЧИЛ ВЛАСТЬ! 💀
            </h3>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto min-h-0 custom-scrollbar">
            {(traitorState?.options || []).map((opt: any, index: number) => (
              <div key={opt?.id ?? index} className="bg-pixel-void/50 border border-pixel-danger/50 p-1.5 rounded text-pixel-light flex justify-between items-center text-xs">
                <span className="font-mono">[{opt?.id}] {opt?.displayName}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )
    }

    if (!voteState || !voteState.isActive) {
      return (
        <div className="bg-pixel-void border border-pixel-muted p-2 text-center rounded flex flex-col items-center justify-center h-24 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
          <Clock size={20} className="text-pixel-muted mb-1 animate-pulse" />
          <motion.span 
            animate={{ opacity: [0.5, 1, 0.5] }} 
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-pixel-light text-xs uppercase tracking-widest "
          >
            Cooldown Active
          </motion.span>
          <span className="text-[10px] text-pixel-cyan mt-1">Waiting for next vote...</span>
          {lastWinner && <div className="mt-1 text-pixel-danger font-bold uppercase text-[10px]">Last Winner: {lastWinner}</div>}
        </div>
      )
    }

    return (
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-pixel-void border border-pixel-amber p-3 rounded relative overflow-hidden shadow-[0_0_10px_rgba(245,158,11,0.3)] flex flex-col min-h-0"
      >
        <div className="flex justify-between items-center mb-2 border-b border-pixel-amber/30 pb-1 flex-shrink-0">
          <div className="text-pixel-amber font-bold flex items-center gap-2 text-xs">
            <Radio className="animate-pulse" size={14} /> VOTE IN PROGRESS
          </div>
          <div className="text-pixel-danger font-mono font-bold animate-pulse text-sm">
            {Math.ceil((voteState?.timeRemainingMs || 0) / 1000)}s
          </div>
        </div>

        {voteState?.intervention && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
            className="bg-pixel-danger/20 border border-pixel-danger text-pixel-danger font-bold text-[10px] uppercase p-1.5 mb-2 text-center rounded shadow-[0_0_10px_rgba(220,38,38,0.3)] flex-shrink-0"
          >
            ⚠️ {voteState.intervention.message}
          </motion.div>
        )}
        
        <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {(voteState?.options || []).map((opt: any, index: number) => {
            const percentage = ((voteState?.totalVotes || 0) > 0) 
              ? Math.round(((opt?.votes || 0) / voteState.totalVotes) * 100) 
              : 0;
            
            const isBlind = voteState?.intervention?.type === 'blind';
            const displayVotes = isBlind ? '???' : opt?.votes || 0;
            const displayPercentage = isBlind ? '???%' : `${percentage}%`;
            const barWidth = isBlind ? '50%' : `${percentage}%`;
            const barColor = isBlind ? 'bg-pixel-danger/70' : 'bg-pixel-cyan';

            return (
              <div key={opt?.id ?? index} className="relative z-10">
                <div className="flex justify-between text-[10px] font-mono text-pixel-light mb-0.5">
                  <span>[{opt?.id}] {opt?.displayName}</span>
                  <span className={isBlind ? "text-pixel-danger font-bold" : "text-pixel-cyan"}>
                    {displayVotes} ({displayPercentage})
                  </span>
                </div>
                <div className="h-1.5 w-full bg-pixel-panel border border-pixel-muted rounded overflow-hidden">
                  <motion.div 
                    className={`h-full ${barColor}`} 
                    initial={{ width: 0 }}
                    animate={{ width: barWidth }}
                    transition={{ duration: 0.5 }}
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
    <div className="bg-pixel-panel border border-pixel-border rounded-lg shadow-pixel p-4 relative h-full grid grid-cols-12 gap-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38bIxsDBBgAEGAAZTwF85bZzQ8AAAAASUVORK5CYII=')]"></div>
      
      {/* LEFT COLUMN: Controls */}
      <div className="col-span-5 flex flex-col gap-3 relative z-10 overflow-hidden bg-pixel-void/40 p-3 rounded border border-pixel-border/50 h-full">
        
        {/* TABS */}
        <div className="flex gap-2 flex-shrink-0 mb-3">
          <button 
            className={`flex-1 py-1.5 text-[10px] uppercase font-bold border rounded transition-colors ${activeTab === 'control' ? 'bg-pixel-amber/20 text-pixel-amber border-pixel-amber shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-pixel-void border-pixel-muted text-pixel-light/50 hover:bg-pixel-muted/20'}`}
            onClick={() => setActiveTab('control')}
          >
            Control
          </button>
          <button 
            className={`flex-1 py-1.5 text-[10px] uppercase font-bold border rounded transition-colors ${activeTab === 'twitch' ? 'bg-[#6441a5]/20 text-[#6441a5] border-[#6441a5] shadow-[0_0_10px_rgba(100,65,165,0.2)]' : 'bg-pixel-void border-pixel-muted text-pixel-light/50 hover:bg-pixel-muted/20'}`}
            onClick={() => setActiveTab('twitch')}
          >
            Twitch
          </button>
          <button 
            className={`flex-1 py-1.5 text-[10px] uppercase font-bold border rounded transition-colors ${activeTab === 'tiers' ? 'bg-pixel-cyan/20 text-pixel-cyan border-pixel-cyan shadow-[0_0_10px_rgba(56,189,248,0.2)]' : 'bg-pixel-void border-pixel-muted text-pixel-light/50 hover:bg-pixel-muted/20'}`}
            onClick={() => setActiveTab('tiers')}
          >
            Tiers
          </button>
          <button 
            className={`flex-1 py-1.5 text-[10px] uppercase font-bold border rounded transition-colors ${activeTab === 'debug' ? 'bg-pixel-danger/20 text-pixel-danger border-pixel-danger shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'bg-pixel-void border-pixel-muted text-pixel-light/50 hover:bg-pixel-muted/20'}`}
            onClick={() => setActiveTab('debug')}
          >
            Debug
          </button>
          <button 
            className={`flex-1 py-1.5 text-[10px] uppercase font-bold border rounded transition-colors ${activeTab === 'settings' ? 'bg-pixel-light/20 text-pixel-light border-pixel-light shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-pixel-void border-pixel-muted text-pixel-light/50 hover:bg-pixel-muted/20'}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-1 min-h-0 relative">
          <AnimatePresence mode="wait">
            {activeTab === 'control' && (
              <motion.div 
                key="control"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3 absolute w-full"
              >
                {/* Launch Game Button */}
                  <motion.button
                    whileHover={{ filter: 'brightness(1.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-pixel-cyan/10 hover:bg-pixel-cyan/20 border border-pixel-cyan/50 text-pixel-cyan text-xs uppercase font-bold py-2 rounded flex items-center justify-center gap-2 shadow-[0_0_5px_rgba(34,211,238,0.3)] transition-colors mt-1"
                    onClick={() => (window as any).api?.launchGame?.()}
                  >
                     🎮 ЗАПУСТИТЬ ИГРУ
                  </motion.button>

                  {/* Start / Stop Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                  <motion.button
                    whileHover={{ filter: 'brightness(1.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col items-center justify-center gap-1 bg-pixel-panel/50 hover:bg-pixel-amber/20 text-pixel-amber border border-pixel-amber/30 p-2 rounded transition-colors"
                    onClick={() => window.api?.startSimulator?.()}
                  >
                    <Play size={16} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Start Event</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ filter: 'brightness(1.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col items-center justify-center gap-1 bg-pixel-panel/50 hover:bg-pixel-danger/20 text-pixel-danger border border-pixel-danger/30 p-2 rounded transition-colors"
                    onClick={() => window.api?.stopSimulator?.()}
                  >
                    <Square size={16} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Stop Event</span>
                  </motion.button>
                </div>

                {/* Traitor Button */}
                <div className="border-t border-pixel-muted/30 pt-3">
                  <motion.button
                    whileHover={{ scale: (trustedCount > 0 && !traitorState?.active) ? 1.02 : 1 }}
                    whileTap={{ scale: (trustedCount > 0 && !traitorState?.active) ? 0.95 : 1 }}
                    className={`w-full flex items-center justify-center gap-2 text-pixel-light font-bold py-2 px-3 border border-pixel-danger/50 rounded shadow-[0_0_10px_rgba(255,0,0,0.2)] transition-all ${
                      (trustedCount > 0 && !traitorState?.active)
                        ? 'bg-pixel-danger/80 hover:bg-pixel-danger' 
                        : 'bg-pixel-muted/50 opacity-50 cursor-not-allowed'
                    }`}
                    onClick={() => window.api?.invokeTraitor?.()}
                    disabled={trustedCount === 0 || traitorState?.active}
                  >
                    <Skull className={trustedCount > 0 && !traitorState?.active ? "animate-pulse text-red-300" : ""} size={16} />
                    <span className="text-xs uppercase tracking-wide">Invoke Traitor</span>
                    {trustedCount > 0 && (
                      <span className="bg-pixel-void text-pixel-light text-[10px] px-1.5 py-0.5 rounded ml-1 shadow-[inset_0_0_5px_rgba(255,0,0,0.5)]">
                        {trustedCount}
                      </span>
                    )}
                  </motion.button>
                </div>
                
                {/* Pacing */}
                <div>
                  <label className="text-[10px] font-bold text-pixel-light/70 uppercase mb-1 flex items-center gap-1">
                    <Clock size={12} /> Event Pacing (Cooldown)
                  </label>
                  <select 
                    className="w-full bg-pixel-void border border-pixel-muted text-pixel-cyan text-xs p-1 rounded outline-none"
                    onChange={(e) => window.api?.updateSettings?.({ cooldownMs: parseInt(e.target.value) })}
                    defaultValue="600000"
                  >
                    <option value="60000">1 Minute (TESTING)</option>
                    <option value="300000">5 Minutes</option>
                    <option value="600000">10 Minutes (DEFAULT)</option>
                    <option value="900000">15 Minutes</option>
                    <option value="1200000">20 Minutes</option>
                  </select>
                </div>

              </motion.div>
            )}

            {activeTab === 'twitch' && (
              <motion.div 
                key="twitch"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3 absolute w-full"
              >
                {/* Twitch Connect Box */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Radar className="text-[#6441a5]" size={14} />
                    <h3 className="text-xs font-bold text-pixel-light/90 uppercase">Twitch Connection</h3>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-pixel-light/70 text-[10px] font-bold uppercase mb-0.5">Channel</label>
                        <input 
                          type="text" 
                          placeholder="lirik" 
                          className="w-full bg-pixel-void/50 border-b border-pixel-muted text-pixel-cyan px-2 py-1 font-mono text-xs outline-none focus:border-pixel-cyan focus:bg-pixel-void transition-colors"
                          value={twitchChannel}
                          onChange={(e) => setTwitchChannel(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-pixel-light/70 text-[10px] font-bold uppercase mb-0.5">Bot Username</label>
                        <input 
                          type="text" 
                          className="w-full bg-pixel-void/50 border-b border-pixel-muted text-pixel-cyan px-2 py-1 font-mono text-xs outline-none focus:border-pixel-cyan focus:bg-pixel-void transition-colors"
                          value={botUsername}
                          onChange={(e) => setBotUsername(e.target.value)}
                          placeholder="my_cool_bot"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-pixel-light/70 text-[10px] font-bold uppercase mb-0.5">OAuth Token</label>
                      <input 
                        type="password" 
                        className="w-full bg-pixel-void/50 border-b border-pixel-muted text-pixel-cyan px-2 py-1 font-mono text-xs outline-none focus:border-pixel-cyan focus:bg-pixel-void transition-colors"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        placeholder="oauth:..."
                      />
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2 mt-1 bg-pixel-void/50 border border-pixel-muted/30 p-1.5 rounded">
                      {twitchStatus?.connected ? (
                        <>
                          {twitchStatus?.botAuthenticated ? (
                            <CheckCircle2 size={12} className="text-green-400" />
                          ) : (
                            <Loader2 size={12} className="text-yellow-400 animate-spin" />
                          )}
                          <span className={`text-[10px] font-mono font-bold ${twitchStatus?.botAuthenticated ? 'text-green-400 animate-pulse' : 'text-yellow-400'}`}>
                            {twitchStatus?.botAuthenticated ? 'BOT AUTHENTICATED' : 'CONNECTED (READ-ONLY)'}
                          </span>
                        </>
                      ) : (
                        <>
                          {tokenStatus === 'validating' && <Loader2 size={12} className="text-yellow-400 animate-spin" />}
                          {tokenStatus === 'valid' && <CheckCircle2 size={12} className="text-green-400" />}
                          {tokenStatus === 'invalid' && <XCircle size={12} className="text-red-400" />}
                          {tokenStatus === 'idle' && <Radio size={12} className="text-pixel-light/70" />}
                          
                          <span className={`text-[10px] font-mono font-bold ${
                            tokenStatus === 'validating' ? 'text-yellow-400' :
                            tokenStatus === 'valid' ? 'text-green-400 animate-pulse' :
                            tokenStatus === 'invalid' ? 'text-red-400' :
                            'text-pixel-light/70'
                          }`}>
                            {tokenStatus === 'validating' && 'VALIDATING TOKEN...'}
                            {tokenStatus === 'valid' && 'READY (BOT AUTHENTICATED)'}
                            {tokenStatus === 'invalid' && 'INVALID TOKEN'}
                            {tokenStatus === 'idle' && 'READY (READ-ONLY)'}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-2">
                      {!twitchStatus?.connected ? (
                        <motion.button
                          whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(145,70,255,0.8)' }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center justify-center gap-2 bg-[#6441a5] text-pixel-light font-bold py-1.5 px-3 border border-pixel-light/50 rounded text-xs shadow-[0_0_5px_rgba(145,70,255,0.5)]"
                          onClick={() => {
                            if (window.api?.saveTwitchAuth) {
                              window.api.saveTwitchAuth(botUsername, botToken, twitchChannel);
                            }
                            window.api?.connectTwitch?.(twitchChannel);
                          }}
                        >
                          Connect
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02, boxShadow: '0 0 10px rgba(156,163,175,0.6)' }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center justify-center gap-2 bg-pixel-muted/50 text-pixel-light font-bold py-1.5 px-3 border border-pixel-light/50 rounded text-xs"
                          onClick={() => window.api?.disconnectTwitch?.()}
                        >
                          Disconnect
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'debug' && (
              <motion.div 
                key="debug"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3 absolute w-full"
              >
                {/* VOICE TESTER */}
                <button
                  onClick={() => setShowTester(true)}
                  className="w-full bg-[#2d1b4e] hover:bg-[#432c7a] border border-[#a855f7] text-[#e9d5ff] font-bold p-2 rounded text-xs tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.3)] transition-all flex items-center justify-center gap-2"
                >
                  <Volume2 size={16} /> МЕНЮ ТЕСТА ГОЛОСОВ (SOUNDBOARD)
                </button>

                {/* Donate Simulation */}
                <div className="border-t border-pixel-muted/30 pt-3 flex gap-2">
                  <motion.button
                    whileHover={{ filter: 'brightness(1.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/50 text-green-400 text-[10px] uppercase font-bold py-1.5 rounded flex items-center justify-center gap-1 shadow-[0_0_5px_rgba(34,197,94,0.3)] transition-colors"
                    onClick={() => (window as any).api?.simulateDonation?.(100)}
                  >
                     💎 100₽
                  </motion.button>
                  <motion.button
                    whileHover={{ filter: 'brightness(1.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] uppercase font-bold py-1.5 rounded flex items-center justify-center gap-1 shadow-[0_0_5px_rgba(239,68,68,0.3)] transition-colors"
                    onClick={() => (window as any).api?.simulateDonation?.(300)}
                  >
                     🚨 300₽
                  </motion.button>
                  <motion.button
                    whileHover={{ filter: 'brightness(1.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-[10px] uppercase font-bold py-1.5 rounded flex items-center justify-center gap-1 shadow-[0_0_5px_rgba(234,179,8,0.3)] transition-colors"
                    onClick={() => (window as any).api?.simulateDonation?.(500)}
                  >
                     👑 500₽
                  </motion.button>
                </div>

                <motion.button
                  whileHover={{ filter: 'brightness(1.2)' }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs uppercase font-bold py-2 rounded flex items-center justify-center gap-2 shadow-[0_0_5px_rgba(249,115,22,0.3)] transition-colors"
                  onClick={() => (window as any).api?.simulatorCombo?.()}
                >
                   🚨 ВМЕШАТЕЛЬСТВО АМБРЕЛЛЫ
                </motion.button>


              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3 absolute w-full"
              >
                <div>
                  <h3 className="text-xs font-bold text-pixel-light/90 uppercase mb-2">Global Hotkeys</h3>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="block text-pixel-light/70 text-[10px] font-bold uppercase mb-0.5">Traitor Mode Hotkey</label>
                      <input 
                        type="text" 
                        className="w-full bg-pixel-void/50 border-b border-pixel-muted text-pixel-cyan px-2 py-1 font-mono text-xs outline-none focus:border-pixel-cyan focus:bg-pixel-void transition-colors"
                        value={hotkeys.traitor}
                        onChange={(e) => setHotkeys({ ...hotkeys, traitor: e.target.value })}
                        placeholder="e.g. num1, F1"
                      />
                    </div>
                    <div>
                      <label className="block text-pixel-light/70 text-[10px] font-bold uppercase mb-0.5">Umbrella Intervention Hotkey</label>
                      <input 
                        type="text" 
                        className="w-full bg-pixel-void/50 border-b border-pixel-muted text-pixel-cyan px-2 py-1 font-mono text-xs outline-none focus:border-pixel-cyan focus:bg-pixel-void transition-colors"
                        value={hotkeys.intervention}
                        onChange={(e) => setHotkeys({ ...hotkeys, intervention: e.target.value })}
                        placeholder="e.g. num2, F2"
                      />
                    </div>
                    <div className="text-[9px] text-pixel-light/50 mt-1">
                      Valid keys: num0-num9, numdec, F1-F24, CommandOrControl+Shift+T, etc.
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-pixel-cyan/10 hover:bg-pixel-cyan/20 border border-pixel-cyan/50 text-pixel-cyan text-xs uppercase font-bold py-1.5 rounded mt-2 shadow-[0_0_5px_rgba(34,211,238,0.3)] transition-colors"
                      onClick={() => window.api?.saveHotkeys?.(hotkeys)}
                    >
                      Save Settings
                    </motion.button>
                  </div>
                </div>

                {/* System Settings */}
                <div className="border-t border-pixel-muted/30 pt-3 mt-1">
                  <h3 className="text-xs font-bold text-pixel-light/90 uppercase mb-2 text-pixel-danger">Danger Zone</h3>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-pixel-danger/10 hover:bg-pixel-danger border border-pixel-danger/50 hover:border-pixel-danger text-pixel-danger hover:text-pixel-void text-xs uppercase font-bold py-1.5 rounded transition-colors"
                    onClick={() => onReinstall && onReinstall()}
                  >
                    ⚙️ Reinstall Game Bridge
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Column (Data/State) */}
      <div className="col-span-7 h-full flex flex-col gap-3 overflow-hidden relative z-10">
        {/* Voting UI at the top */}
        <div className="flex flex-col min-h-0 max-h-[50%]">
          {renderVotingUI()}
        </div>

        {/* Top Karma & Logs at the bottom */}
        <div className="flex gap-3 flex-1 min-h-0">
          <div className="w-1/3 bg-gradient-to-b from-pixel-void to-pixel-void/80 border border-pixel-muted/50 p-2 rounded text-xs text-pixel-cyan font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden after:content-[''] after:absolute after:inset-0 after:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38bIxsDBBgAEGAAZTwF85bZzQ8AAAAASUVORK5CYII=')] after:opacity-10 after:pointer-events-none">
            <h3 className="text-pixel-amber font-bold mb-2 border-b border-pixel-amber/30 pb-1 text-center text-[10px] uppercase relative z-10">Top Karma</h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar min-h-0 pr-1 relative z-10">
              {(!leaderboard || leaderboard.length === 0) ? (
                <div className="text-pixel-muted/50 text-center text-[10px] mt-2">No data...</div>
              ) : (
                leaderboard.map((viewer, idx) => (
                  <div key={viewer?.username || idx} className="flex justify-between items-center mb-1.5">
                    <span className="text-pixel-light/80 truncate pr-1 text-[10px]">{idx + 1}. {viewer?.username}</span>
                    <span className="text-pixel-cyan font-bold bg-pixel-panel/50 px-1 border border-pixel-muted/30 text-[10px] rounded-sm">{viewer?.karma}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="w-2/3 bg-gradient-to-b from-pixel-void to-pixel-void/80 border border-pixel-muted/50 p-2 rounded text-xs text-pixel-cyan font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] relative flex flex-col min-h-0 overflow-hidden after:content-[''] after:absolute after:inset-0 after:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38bIxsDBBgAEGAAZTwF85bZzQ8AAAAASUVORK5CYII=')] after:opacity-10 after:pointer-events-none">
            <h3 className="text-pixel-light/50 font-bold mb-1 border-b border-pixel-border/30 pb-1 text-[10px] uppercase relative z-10">System Logs</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-1 text-[10px] relative z-10">
              {(logs || []).map((log, index) => (
                <div key={index} className="mb-1.5 break-all border-b border-pixel-border/20 pb-1 flex flex-col gap-0.5">
                  <div className="text-[9px] text-pixel-light/30">{log.timestamp}</div>
                  <div className="flex items-start">
                    {log?.type === 'system' ? (
                      <span className="text-pixel-danger font-bold opacity-100">{log?.message}</span>
                    ) : (
                      <>
                        <span className="text-pixel-amber mr-1">{'>'}</span>
                        <span className="opacity-70 text-pixel-light/60">{log?.username}: </span>
                        <span className="opacity-90 ml-1 text-pixel-cyan font-bold">{log?.command}</span>
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
      <AnimatePresence>
        {activeTab === 'tiers' && <TiersConfigurator onClose={() => setActiveTab('control')} />}
        {showTester && <VoiceTester onClose={() => setShowTester(false)} />}
      </AnimatePresence>
    </div>
  )



}
