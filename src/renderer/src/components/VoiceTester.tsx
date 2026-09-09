import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Play, Volume2 } from 'lucide-react'

export function VoiceTester({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<Record<string, string[]>>({})
  const [playing, setPlaying] = useState<string | null>(null)
  const [volume, setVolume] = useState<number>(80)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Load files map from backend
    ;(window as any).electron.ipcRenderer.invoke('audio:get-files').then(setFiles)

    // Load initial volume
    if (window.api?.getVolume) {
      window.api.getVolume().then((v: number) => {
        if (typeof v === 'number') setVolume(v)
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol)
    if (window.api?.setVolume) {
      window.api.setVolume(newVol)
    }
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, newVol / 100))
    }
  }

  const playFile = async (folder: string, file: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setPlaying(file)
    const base64 = await (window as any).electron.ipcRenderer.invoke('audio:read-file', folder, file)
    if (base64) {
      const mime = file.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg'
      const audio = new Audio(`data:${mime};base64,${base64}`)
      audio.volume = Math.max(0, Math.min(1, volume / 100))
      audioRef.current = audio
      audio.onended = () => setPlaying(null)
      audio.play().catch(e => {
        console.error("Audio play error", e)
        setPlaying(null)
      })
    } else {
      setPlaying(null)
    }
  }

  const scenarioLabels: Record<string, string> = {
    veto: 'Вето (Отмена)',
    invert: 'Инверсия',
    blind: 'Слепота',
    equalize: 'Уравнивание',
    turbo: 'Турбо-режим',
    negative_win: 'Победа негатива',
    positive_win: 'Победа позитива',
    traitor: 'Предатель'
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-pixel-void border border-pixel-cyan/40 rounded-lg shadow-[0_0_20px_rgba(65,166,246,0.2)] flex flex-col h-full max-h-[520px]"
      >
        <div className="flex items-center justify-between p-3 border-b border-pixel-cyan/20 bg-pixel-panel">
          <div className="flex items-center gap-2 text-pixel-cyan font-bold tracking-widest text-sm">
            <Volume2 size={16} /> ТЕСТЕР ОЗВУЧКИ И САУНДБОРД
          </div>

          <div className="flex items-center gap-4">
            {/* Volume Slider in Header */}
            <div className="flex items-center gap-2 bg-pixel-void/80 px-2.5 py-1 rounded border border-pixel-cyan/30">
              <Volume2 size={14} className="text-pixel-cyan" />
              <span className="text-[10px] text-pixel-light/80 uppercase font-bold">Громкость:</span>
              <input 
                type="range" 
                min={0} 
                max={100} 
                value={volume} 
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-24 accent-pixel-cyan h-1.5 cursor-pointer bg-pixel-panel rounded"
              />
              <span className="text-[10px] font-mono text-pixel-cyan font-bold w-8 text-right">{volume}%</span>
            </div>

            <button onClick={onClose} className="text-pixel-muted hover:text-pixel-danger transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-pixel-cyan/20 bg-pixel-void/50">
          <h3 className="text-pixel-cyan text-xs tracking-widest font-bold mb-1 flex items-center gap-2">
            <Play size={14} /> ПРОИГРАТЬ СЦЕНАРИЙ (В ОБС ОВЕРЛЕЕ)
          </h3>
          <p className="text-[10px] text-pixel-muted mb-3">Эти кнопки запускают полный пайплайн с эффектами рации, оверлеем и субтитрами, как в игре.</p>
          <div className="grid grid-cols-4 gap-2">
            {['veto', 'invert', 'blind', 'equalize', 'turbo', 'negative_win', 'positive_win', 'traitor'].map(type => (
              <button
                key={'sim_' + type}
                onClick={() => (window as any).electron.ipcRenderer.invoke('simulator:force-narrator', type)}
                className="bg-pixel-panel border border-pixel-cyan/50 hover:bg-pixel-cyan hover:text-pixel-void text-pixel-light p-1.5 text-[10px] rounded uppercase font-bold transition-colors truncate text-center"
                title={scenarioLabels[type] || type}
              >
                {scenarioLabels[type] || type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6 custom-scrollbar">
          {Object.entries(files).map(([folder, fileList]) => (
            <div key={folder} className="space-y-2">
              <h3 className="text-pixel-amber text-xs tracking-widest uppercase border-b border-pixel-amber/20 pb-1">
                ПАПКА: {folder}
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
                  <div className="text-pixel-muted text-xs italic">Файлы не найдены.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

