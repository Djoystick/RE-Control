import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Clock } from 'lucide-react'

interface VoteOption {
  id: number
  effectId: string
  displayName: string
  votes: number
}

interface VoteState {
  isActive: boolean
  options: VoteOption[]
  timeRemainingMs: number
  totalVotes: number
  roundType?: 'normal' | 'boss'
  boss?: { threshold: number; votes: number; passed: boolean } | null
  intervention?: {
    type: 'veto' | 'invert' | 'blind' | 'equalize'
    message: string
  }
}

interface EffectState {
  effect: string
  duration: number
}



const activeAudios = new Set<HTMLAudioElement>();
let overlayVolume = 0.8;

async function playFilteredAudio(base64: string, mime: string = 'audio/ogg', volume?: number) {
    return new Promise<void>((resolve, reject) => {
        const audio = new Audio(`data:${mime};base64,${base64}`);
        const finalVol = typeof volume === 'number' ? volume : overlayVolume;
        audio.volume = Math.max(0, Math.min(1, finalVol));
        activeAudios.add(audio);
        
        audio.onended = () => {
            activeAudios.delete(audio);
            resolve();
        };
        audio.onerror = () => {
            activeAudios.delete(audio);
            reject(new Error("Audio decoding error"));
        };
        audio.play().catch(err => {
            activeAudios.delete(audio);
            if (err.name === 'NotAllowedError') {
                reject(new Error("БРАУЗЕР БЛОКИРУЕТ ЗВУК! КЛИКНИ МЫШКОЙ ПО ОКНУ ОВЕРЛЕЯ!"));
            } else {
                reject(err);
            }
        });
    });
}

export default function OverlayApp() {
  const [voteState, setVoteState] = useState<VoteState | null>(null)
  const [activeEffect, setActiveEffect] = useState<EffectState | null>(null)
  const [interventionBanner, setInterventionBanner] = useState<{ type: string; message: string } | null>(null)
  const [narratorData, setNarratorData] = useState<{ text: string, type: string } | null>(null)
  const [reportData, setReportData] = useState<any | null>(null)
  const [announcements, setAnnouncements] = useState<{ text: string; at: number }[]>([])
  
  // Local timer for smooth countdown
  const [localTimeRemaining, setLocalTimeRemaining] = useState(0)

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: any;
    let bannerTimer: any;
    let narratorTimer: any;
    let narratorDataTimer: any;
    let effectTimer: any;
    let reportTimer: any;
    
    const connect = () => {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = loc.host || '127.0.0.1:27016';
      const params = new URLSearchParams(loc.search);
      const token = params.get('token');
      const wsUrl = `${protocol}//${host}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'vote:update' || msg.type === 'vote:start') {
            setVoteState(msg.data)
            setLocalTimeRemaining(msg.data.timeRemainingMs)
          } else if (msg.type === 'vote:end') {
            setVoteState(null)
            setInterventionBanner(null)
          } else if (msg.type === 'announce') {
            setAnnouncements((prev) => [...prev.slice(-2), { text: msg.data.text, at: Date.now() }])
          } else if (msg.type === 'vote:shielded') {
            setVoteState(null)
            setInterventionBanner({ type: 'shield', message: `🛡 ЗАЩИТА @${msg.data.by}: [${msg.data.cancelled}] нейтрализован` })
            clearTimeout(bannerTimer)
            bannerTimer = setTimeout(() => setInterventionBanner(null), 6000)
          } else if (msg.type === 'boss:failed') {
            setVoteState(null)
            setInterventionBanner({ type: 'boss_failed', message: `💀 БОСС ПРОВАЛЕН: ${msg.data.votes}/${msg.data.threshold} — [${msg.data.cancelled}] не активирован` })
            clearTimeout(bannerTimer)
            bannerTimer = setTimeout(() => setInterventionBanner(null), 8000)
          } else if (msg.type === 'report:session') {
            setReportData(msg.data)
            clearTimeout(reportTimer)
            reportTimer = setTimeout(() => setReportData(null), 15000)
          } else if (msg.type === 'vote:intervention') {
            setInterventionBanner(msg.data)
            clearTimeout(bannerTimer)
            bannerTimer = setTimeout(() => setInterventionBanner(null), 8000)
          } else if (msg.type === 'narrator:set-volume') {
            if (typeof msg.data?.volume === 'number') {
              overlayVolume = Math.max(0, Math.min(1, msg.data.volume))
            }
          } else if (msg.type === 'narrator:audio') {
            setNarratorData({ text: msg.data.subtitle, type: msg.data.type })
            clearTimeout(narratorDataTimer)
            narratorDataTimer = setTimeout(() => setNarratorData(null), 6000)
            playFilteredAudio(msg.data.base64, msg.data.mime || 'audio/ogg', msg.data.volume).catch(e => setNarratorData({ text: 'AUDIO ERROR: ' + e.message, type: 'veto' }))
          } else if (msg.type === 'narrator:speak') {
            setNarratorData({ text: msg.data.text, type: msg.data.type || 'veto' })
            clearTimeout(narratorTimer)
            narratorTimer = setTimeout(() => setNarratorData(null), 8000)
          } else if (msg.type === 'effect:start') {
            setActiveEffect(msg.data)
            // Auto hide effect after its duration
            clearTimeout(effectTimer)
            effectTimer = setTimeout(() => {
              setActiveEffect(null)
            }, msg.data.duration || 10000)
          } else if (msg.type === 'effect:end') {
            clearTimeout(effectTimer)
            setActiveEffect(null)
          }
        } catch (e) {
          console.error('Failed to parse WS message', e)
        }
      }

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000)
      }
    }
    
    connect()
    
    return () => {
      clearTimeout(reconnectTimer)
      clearTimeout(bannerTimer)
      clearTimeout(narratorTimer)
      clearTimeout(narratorDataTimer)
      clearTimeout(effectTimer)
      if (ws) ws.close()
      
      activeAudios.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      activeAudios.clear();
    }
  }, [])

  useEffect(() => {
    if (!voteState?.isActive || localTimeRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setLocalTimeRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [voteState?.isActive, localTimeRemaining]);

  // Prune announcement stack: each item lives 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setAnnouncements((prev) => prev.filter(a => Date.now() - a.at < 12000))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-screen h-screen overflow-hidden p-8 relative font-pixel">
      <AnimatePresence>
        {activeEffect && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: "-50%", scale: 0.75 }}
              animate={{ opacity: 1, y: 0, x: "-50%", scale: 0.8 }}
              exit={{ opacity: 0, y: -50, x: "-50%", scale: 0.75 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-12 left-1/2  bg-pixel-danger border-4 border-pixel-dark rounded-xl p-6 shadow-pixel flex items-center gap-6 z-50 text-white"
          >
            <div className="w-6 h-6 rounded-full bg-white animate-arcade-blink shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
            <h2 className="text-3xl font-bold tracking-widest drop-shadow-[2px_2px_0_rgba(0,0,0,1)] uppercase">
              ACTIVE: {activeEffect.effect}
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-12 right-12 flex flex-col gap-4 items-end" style={{ transform: "scale(0.75)", transformOrigin: "bottom right" }}>
        <AnimatePresence>
          {voteState?.isActive && voteState.options && (
            <motion.div
              initial={{ opacity: 0, x: 100, rotate: 2 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              exit={{ opacity: 0, x: 100, rotate: -2 }}
              transition={{ type: 'spring', damping: 20 }}
              className="bg-pixel-panel border-4 border-pixel-cyan text-white p-6 rounded-xl shadow-pixel backdrop-blur-md w-[400px]"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b-4 border-pixel-border">
                <div className="flex items-center gap-3">
                  <Activity className={voteState.roundType === 'boss' ? 'text-pixel-danger animate-pulse' : 'text-pixel-cyan animate-pulse'} size={28} />
                  <div className="flex flex-col">
                    <h3 className={`text-2xl font-bold tracking-wider drop-shadow-md ${voteState.roundType === 'boss' ? 'text-pixel-danger' : 'text-pixel-cyan'}`}>
                      {voteState.roundType === 'boss' ? 'BOSS ROUND' : 'VOTE NOW'}
                    </h3>
                    {voteState.roundType === 'boss' && (
                      <span className="text-xs font-bold text-pixel-amber tracking-widest">
                        ЯВКА: {voteState.totalVotes}/{voteState.boss?.threshold ?? 0} — ИНАЧЕ ПРОВАЛ
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-pixel-amber bg-pixel-dark px-3 py-1 rounded border-2 border-pixel-amber/50">
                  <Clock size={20} className="animate-pulse" />
                  <span className="text-2xl font-bold">
                    {Math.ceil(localTimeRemaining / 1000)}s
                  </span>
                </div>
              </div>

              <AnimatePresence>
                {interventionBanner && (
                  <motion.div
                    key={interventionBanner.message}
                    initial={{ opacity: 0, scaleY: 0, marginBottom: 0 }}
                    animate={{ 
                      opacity: 1, 
                      scaleY: 1,
                      marginBottom: 16,
                    }}
                    exit={{ opacity: 0, scaleY: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-pixel-danger border-2 border-red-900 py-3 px-4 rounded-lg flex items-center justify-center text-white font-bold tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.9)] overflow-hidden text-center origin-top"
                  >
                    <motion.span
                      animate={{ opacity: [1, 0.6, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="text-sm uppercase"
                    >
                      ⚠️ {interventionBanner.message} ⚠️
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-5">
                {voteState.options.map((opt) => {
                  const percentage = voteState.totalVotes > 0 
                    ? Math.round((opt.votes / voteState.totalVotes) * 100) 
                    : 0;
                  
                  const isBlind = voteState.intervention?.type === 'blind';
                  const displayVotes = isBlind ? '???' : opt.votes;
                  const displayPercentage = isBlind ? '???%' : `${percentage}%`;
                  const barWidth = isBlind ? '50%' : `${percentage}%`;
                  const barColor = isBlind ? 'bg-pixel-danger' : 'bg-pixel-cyan';
                  
                  return (
                    <div key={opt.id} className="relative">
                      <div className="flex justify-between text-lg mb-2 z-10 relative drop-shadow-md font-bold">
                        <span className="text-pixel-light">!{opt.id} <span className="text-pixel-amber">{opt.displayName}</span></span>
                        <span className={isBlind ? "text-pixel-danger" : "text-pixel-cyan"}>
                          {displayVotes} <span className="text-sm text-pixel-muted">({displayPercentage})</span>
                        </span>
                      </div>
                      <div className="w-full bg-pixel-dark border-2 border-pixel-border h-8 rounded-lg overflow-hidden relative shadow-pixel-inner">
                        <motion.div 
                          className={`absolute top-0 left-0 h-full ${barColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: barWidth }}
                          transition={{ type: "spring", damping: 15 }}
                        >
                          <div className="w-full h-full opacity-30 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
                        </motion.div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

              {/* Narrator subtitle — top center, bold arcade style */}
        <AnimatePresence>
          {narratorData && (
            <motion.div
              key={narratorData.text}
              initial={{ opacity: 0, y: -50, x: "-50%", scale: 0.75 }}
              animate={{ opacity: 1, y: 0, x: "-50%", scale: 0.8 }}
              exit={{ opacity: 0, y: -50, x: "-50%", scale: 0.75 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className={`absolute top-24 left-1/2  border-4 rounded-xl p-4 md:p-6 shadow-pixel flex items-center gap-4 md:gap-6 z-50 text-white min-w-[500px] justify-center ${
                narratorData.type === 'positive_win' 
                  ? 'bg-[#1e3a8a] border-pixel-cyan' 
                  : 'bg-[#7f1d1d] border-[#111111]'
              }`}
            >
              <div className={`w-4 h-4 md:w-6 md:h-6 rounded-full animate-arcade-blink flex-shrink-0 ${
                narratorData.type === 'positive_win' ? 'bg-pixel-cyan shadow-[0_0_15px_rgba(34,211,238,0.8)]' : 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]'
              }`} />
              <div className="flex flex-col">
                <span className={`text-[10px] tracking-[0.3em] font-bold mb-1 ${narratorData.type === 'positive_win' ? 'text-pixel-cyan' : 'text-[#a1a1aa]'}`}>
                  {narratorData.type === 'positive_win' ? '▶ СОЮЗНИК НА СВЯЗИ' : '◈ UMBRELLA CORP'}
                </span>
                <h2 className="text-xl md:text-3xl font-bold tracking-widest drop-shadow-[2px_2px_0_rgba(0,0,0,1)] uppercase leading-tight">
                  {narratorData.text}
                </h2>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Announcements — bot messages when running in read-only Twitch mode */}
        <div className="absolute top-12 left-12 flex flex-col gap-2 items-start">
          {announcements.map((a) => (
            <div
              key={a.at}
              className="bg-[#0d1117ee] border-l-4 border-[#e01c3f] text-white px-4 py-2 rounded shadow-[0_4px_16px_rgba(0,0,0,0.6)] max-w-[560px] text-sm"
            >
              {a.text}
            </div>
          ))}
        </div>

        {/* Session report — shareable post-stream summary */}
        <AnimatePresence>
          {reportData && (
            <motion.div
              key="session-report"
              initial={{ opacity: 0, x: 120 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 120 }}
              transition={{ type: 'spring', damping: 22 }}
              className="absolute bottom-12 left-12 bg-pixel-panel border-4 border-pixel-amber text-white p-6 rounded-xl shadow-pixel w-[460px]"
            >
              <div className="flex items-center gap-3 mb-3 border-b-4 border-pixel-border pb-3">
                <span className="text-3xl">📊</span>
                <h3 className="text-2xl font-bold tracking-wider text-pixel-amber uppercase">ИТОГИ СТРИМА</h3>
              </div>
              <p className="text-sm text-pixel-muted mb-3">Раундов: {reportData.rounds}</p>
              <div className="flex flex-col gap-2">
                {(reportData.leaderboard || []).map((v: any, i: number) => (
                  <div key={v.username} className="flex justify-between text-lg font-bold">
                    <span className="text-pixel-light">{i + 1}. {v.username}</span>
                    <span className="text-pixel-cyan">{v.karma > 0 ? `+${v.karma}` : v.karma}</span>
                  </div>
                ))}
              </div>
              {reportData.hostile && (
                <p className="mt-3 text-sm text-pixel-danger">
                  ☠ Самый кровожадный: {reportData.hostile.username} ({reportData.hostile.negativeVotes})
                </p>
              )}
              {reportData.megaMoments?.length > 0 && (
                <p className="mt-1 text-sm text-pixel-amber">💥 MEGA: {reportData.megaMoments.join(', ')}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  )
}
