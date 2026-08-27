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
  intervention?: {
    type: 'veto' | 'invert' | 'blind' | 'equalize'
    message: string
  }
}

interface EffectState {
  effect: string
  duration: number
}

export default function OverlayApp() {
  const [voteState, setVoteState] = useState<VoteState | null>(null)
  const [activeEffect, setActiveEffect] = useState<EffectState | null>(null)
  const [interventionBanner, setInterventionBanner] = useState<{ type: string; message: string } | null>(null)
  const [narratorText, setNarratorText] = useState<string | null>(null)
  
  // Local timer for smooth countdown
  const [localTimeRemaining, setLocalTimeRemaining] = useState(0)

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: any;
    let bannerTimer: any;
    let narratorTimer: any;
    
    const connect = () => {
      ws = new WebSocket('ws://localhost:27016')
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'vote:update' || msg.type === 'vote:start') {
            setVoteState(msg.data)
            setLocalTimeRemaining(msg.data.timeRemainingMs)
          } else if (msg.type === 'vote:end') {
            setVoteState(null)
            setInterventionBanner(null)
          } else if (msg.type === 'vote:intervention') {
            setInterventionBanner(msg.data)
            clearTimeout(bannerTimer)
            bannerTimer = setTimeout(() => setInterventionBanner(null), 8000)
          } else if (msg.type === 'narrator:speak') {
            setNarratorText(msg.data.text)
            clearTimeout(narratorTimer)
            narratorTimer = setTimeout(() => setNarratorText(null), 8000)
          } else if (msg.type === 'effect:start') {
            setActiveEffect(msg.data)
            // Auto hide effect after its duration
            setTimeout(() => {
              setActiveEffect(null)
            }, msg.data.duration || 10000)
          } else if (msg.type === 'effect:end') {
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
      if (ws) ws.close()
    }
  }, [])

  useEffect(() => {
    if (!voteState?.isActive || localTimeRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setLocalTimeRemaining(prev => Math.max(0, prev - 100));
    }, 100);
    
    return () => clearInterval(interval);
  }, [voteState?.isActive, localTimeRemaining]);

  return (
    <div className="w-screen h-screen overflow-hidden p-8 relative font-pixel">
      <AnimatePresence>
        {activeEffect && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 bg-pixel-danger border-4 border-pixel-dark rounded-xl p-6 shadow-pixel flex items-center gap-6 z-50 text-white"
          >
            <div className="w-6 h-6 rounded-full bg-white animate-arcade-blink shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
            <h2 className="text-3xl font-bold tracking-widest drop-shadow-[2px_2px_0_rgba(0,0,0,1)] uppercase">
              ACTIVE: {activeEffect.effect}
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-12 right-12 flex flex-col gap-4 items-end">
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
                  <Activity className="text-pixel-cyan animate-pulse" size={28} />
                  <h3 className="text-2xl text-pixel-cyan font-bold tracking-wider drop-shadow-md">VOTE NOW</h3>
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

      {/* Narrator subtitle — bottom center, cinematic style */}
      <AnimatePresence>
        {narratorText && (
          <motion.div
            key={narratorText}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 max-w-2xl w-full px-6"
          >
            <div className="bg-black/80 border border-pixel-muted/40 rounded px-6 py-3 text-center backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.8)]">
              <p className="text-pixel-light font-mono text-sm tracking-widest uppercase leading-relaxed">
                <span className="text-pixel-danger mr-2 text-xs">◈ UMBRELLA CORP</span>
                {narratorText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
