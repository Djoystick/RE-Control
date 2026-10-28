import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Minus } from 'lucide-react'
import { SimulatorPanel } from './components/SimulatorPanel'
import { SetupWizard } from './components/SetupWizard'

function App() {
  const [setupDone, setSetupDone] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSetup = async () => {
      const storedPath = await (window as any).api?.getStoredGamePath?.()
      if (storedPath) {
        setSetupDone(true)
      }
      setIsLoading(false)
    }
    checkSetup()
  }, [])

  return (
    <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent">
      <motion.div
        className="rc-shell-wrap relative"
        style={{ width: 900, height: 650, filter: 'none', background: 'transparent' }}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="rc-shell draggable">
          {/* CHASSIS DECOR */}
          <div className="rc-noise" />
          <div className="rc-bolts" />
          <div className="rc-port" />
          <div className="rc-vent" />
          
          {/* WINDOW CONTROLS */}
          <div className="absolute top-[28px] right-[40px] flex gap-2 z-50">
            <button 
              className="no-drag w-7 h-7 flex items-center justify-center bg-[#10121a] border border-[#262c3e] text-zinc-400 hover:bg-[#181c28] hover:text-zinc-100 rounded transition-colors"
              onClick={() => (window as any).api.minimizeWindow()}
              title="Свернуть"
            >
              <Minus size={15} strokeWidth={2.5} />
            </button>
            <button 
              className="no-drag w-7 h-7 flex items-center justify-center bg-[#10121a] border border-red-950/80 hover:border-red-800/80 text-red-500 hover:bg-red-950/40 hover:text-red-300 rounded transition-colors"
              onClick={() => (window as any).api.closeWindow()}
              title="Закрыть"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          {/* TOP HARDWARE TITLE */}
          <div className="absolute top-[28px] left-0 w-full flex justify-center pointer-events-none z-50">
             <div className="px-5 py-1 bg-[#0b0d13] border-b border-red-950/80 rounded-b-lg shadow-[0_4px_12px_rgba(0,0,0,0.8)] flex items-center gap-3">
               <div className="flex items-end gap-[2px] h-3.5">
                 {[1, 2, 3, 4].map((i) => (
                   <motion.div
                     key={`eq-${i}`}
                     className="w-1 bg-red-600/70 rounded-t-[1px]"
                     animate={{ height: ["25%", "90%", "35%", "80%", "25%"] }}
                     transition={{ 
                       duration: 0.7 + (i * 0.12), 
                       repeat: Infinity, 
                       repeatType: "mirror"
                     }}
                   />
                 ))}
               </div>
               <h1 className="text-base text-zinc-200 tracking-[0.25em] font-mono font-bold drop-shadow-[0_2px_4px_rgba(220,38,38,0.3)]">
                  RE:<span className="text-red-600 font-bold">CONTROL</span>
               </h1>
             </div>
          </div>

          {/* SCREEN SAFE ZONE - Perfectly sized to fit inside the CRT bezel */}
          <div className="absolute top-[75px] bottom-[55px] left-[40px] right-[40px] flex flex-col z-10">
            <div className="rc-screen no-drag w-full h-full flex flex-col relative rounded-md overflow-hidden bg-[#0a0c10]">
              <div className="absolute inset-0 pointer-events-none opacity-20 z-0" 
                   style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.04))', backgroundSize: '100% 4px, 6px 100%' }} />
              
              <div className="rc-content relative z-10 w-full h-full flex flex-col p-1.5">
                 {!isLoading && (
                   setupDone ? (
                     <>
                       <SimulatorPanel onReinstall={() => setSetupDone(false)} />
                     </>
                   ) : (
                     <SetupWizard onComplete={() => setSetupDone(true)} />
                   )
                 )}
              </div>
            </div>
          </div>

          {/* STATUS BAR - Safely positioned on the physical flat part of the bottom bezel */}
          <div className="absolute bottom-[38px] left-[70px] right-[70px] flex justify-between items-center text-[10px] text-zinc-400 tracking-wider pointer-events-none z-50 font-mono">
            <div className="flex items-center gap-2 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
              <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.8)]"></span>
              STATUS: <b className="text-zinc-200 ml-1 font-mono tracking-wider">SYSTEM ACTIVE</b>
            </div>
            <div className="flex items-center gap-2 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
              TARGET: <b className="text-red-400 ml-1 font-mono tracking-wider">RESIDENT EVIL 2</b>
            </div>
          </div>
            
        </div>
      </motion.div>
    </div>
  )
}

export default App



