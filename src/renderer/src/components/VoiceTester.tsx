import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Play, Volume2 } from 'lucide-react'

export function VoiceTester({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<Record<string, string[]>>({})
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    // Load files map from backend
    ;(window as any).electron.ipcRenderer.invoke('audio:get-files').then(setFiles)
  }, [])

  const playFile = async (folder: string, file: string) => {
    setPlaying(file)
    const base64 = await (window as any).electron.ipcRenderer.invoke('audio:read-file', folder, file)
    if (base64) {
      const mime = file.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg'
      const audio = new Audio(`data:${mime};base64,${base64}`)
      audio.onended = () => setPlaying(null)
      audio.play().catch(e => {
        console.error("Audio play error", e)
        setPlaying(null)
      })
    } else {
      setPlaying(null)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-pixel-void border border-pixel-cyan/40 rounded-lg shadow-[0_0_20px_rgba(65,166,246,0.2)] flex flex-col h-full max-h-[500px]"
      >
        <div className="flex items-center justify-between p-3 border-b border-pixel-cyan/20 bg-pixel-panel">
          <div className="flex items-center gap-2 text-pixel-cyan font-bold tracking-widest text-sm">
            <Volume2 size={16} /> SOUNDBOARD TESTER
          </div>
          <button onClick={onClose} className="text-pixel-muted hover:text-pixel-danger transition-colors">
            <X size={18} />
          </button>
        </div>

        
        <div className="p-4 border-b border-pixel-cyan/20 bg-pixel-void/50">
          <h3 className="text-pixel-cyan text-xs tracking-widest font-bold mb-2 flex items-center gap-2">
            <Play size={14} /> ПРОИГРАТЬ РЕАЛЬНЫЙ СЦЕНАРИЙ (В ОВЕРЛЕЕ)
          </h3>
          <p className="text-[10px] text-pixel-muted mb-3">Эти кнопки запускают полный пайплайн с эффектами рации и субтитрами, как в игре.</p>
          <div className="grid grid-cols-4 gap-2">
            {['veto', 'invert', 'blind', 'equalize', 'turbo', 'negative_win', 'positive_win', 'traitor'].map(type => (
              <button
                key={'sim_' + type}
                onClick={() => (window as any).electron.ipcRenderer.invoke('simulator:force-narrator', type)}
                className="bg-pixel-panel border border-pixel-cyan/50 hover:bg-pixel-cyan hover:text-pixel-void text-pixel-light p-1.5 text-[10px] rounded uppercase font-bold transition-colors"
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6 custom-scrollbar">
          {Object.entries(files).map(([folder, fileList]) => (
            <div key={folder} className="space-y-2">
              <h3 className="text-pixel-amber text-xs tracking-widest uppercase border-b border-pixel-amber/20 pb-1">
                DIR: {folder}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {fileList.map(file => (
                  <button
                    key={file}
                    onClick={() => playFile(folder, file)}
                    className={`flex items-center gap-2 p-2 text-xs border rounded transition-colors text-left ${
                      playing === file
                        ? 'bg-pixel-cyan text-pixel-void border-pixel-cyan shadow-[0_0_10px_rgba(65,166,246,0.5)]'
                        : 'bg-pixel-panel border-pixel-muted/30 text-pixel-light/80 hover:border-pixel-cyan/50 hover:text-pixel-light'
                    }`}
                  >
                    <Play size={12} className={playing === file ? 'animate-pulse' : 'opacity-50'} />
                    <span className="truncate">{file}</span>
                  </button>
                ))}
                {fileList.length === 0 && (
                  <div className="text-pixel-muted text-xs italic">No files found.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
