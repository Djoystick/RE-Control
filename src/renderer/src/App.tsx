import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Minus, Settings } from 'lucide-react'
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
              className="no-drag w-7 h-7 flex items-center justify-center bg-pixel-panel border border-pixel-cyan/50 text-pixel-cyan hover:bg-pixel-cyan hover:text-pixel-void rounded shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-colors"
              onClick={() => (window as any).api.minimizeWindow()}
            >
              <Minus size={16} strokeWidth={3} />
            </button>
            <button 
              className="no-drag w-7 h-7 flex items-center justify-center bg-pixel-panel border border-pixel-danger/50 text-pixel-danger hover:bg-pixel-danger hover:text-pixel-void rounded shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-colors"
              onClick={() => (window as any).api.closeWindow()}
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>

          {/* TOP HARDWARE TITLE */}
          <div className="absolute top-[28px] left-0 w-full flex justify-center pointer-events-none z-50">
             <div className="px-6 py-1 bg-[#10121d] border-b-2 border-pixel-cyan/30 rounded-b-xl shadow-[0_4px_10px_rgba(0,0,0,0.5)] flex items-center gap-3">
               <div className="flex items-end gap-[2px] h-4">
                 {[1, 2, 3, 4].map((i) => (
                   <motion.div
                     key={`eq-${i}`}
                     className="w-1.5 bg-pixel-cyan/80 rounded-t-[1px]"
                     animate={{ height: ["30%", "100%", "40%", "90%", "30%"] }}
                     transition={{ 
                       duration: 0.6 + (i * 0.1), 
                       repeat: Infinity, 
                       repeatType: "mirror"
                     }}
                   />
                 ))}
               </div>
               <h1 className="text-xl text-pixel-light/90 tracking-[0.25em] font-pixel drop-shadow-[0_2px_4px_rgba(65,166,246,0.6)] animate-pulse">
                  RE:<span className="text-pixel-danger font-bold">CONTROL</span>
               </h1>
             </div>
          </div>

          {/* SCREEN SAFE ZONE - Perfectly sized to fit inside the CRT bezel */}
          <div className="absolute top-[75px] bottom-[55px] left-[40px] right-[40px] flex flex-col z-10">
            <div className="rc-screen no-drag w-full h-full flex flex-col relative rounded-md overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-20 z-0" 
                   style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.04))', backgroundSize: '100% 4px, 6px 100%' }} />
              
              <div className="rc-content relative z-10 w-full h-full flex flex-col p-2">
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
          <div className="absolute bottom-[38px] left-[70px] right-[70px] flex justify-between items-center text-[11px] sm:text-xs text-pixel-light/80 tracking-widest pointer-events-none z-50">
            <div className="flex items-center gap-2 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
              <span className="rec-dot w-2 h-2 rounded-full bg-pixel-danger animate-ping shadow-[0_0_8px_var(--rc-red)]"></span>
              STATUS: <b className="text-pixel-amber ml-1 drop-shadow-[0_0_6px_rgba(255,205,117,0.5)]">LINK ESTABLISHED</b>
            </div>
            <div className="flex items-center gap-2 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
              TARGET: <b className="text-pixel-cyan ml-1 drop-shadow-[0_0_6px_rgba(65,166,246,0.5)]">RESIDENT EVIL 2</b>
            </div>
          </div>
            
        </div>
      </motion.div>
    </div>
  )
}

export default App



