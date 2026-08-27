import React, { useState, useEffect } from 'react';
import { Check, FolderSearch, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GameVariant {
  label: string;
  archiveName: string;
  tooltip?: string;
}

interface GameConfig {
  id: string;
  displayName: string;
  steamAppId: string;
  exeName: string;
  variants: GameVariant[];
}

export const SetupWizard: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [games, setGames] = useState<GameConfig[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);
  
  const [gamePath, setGamePath] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const [installProgress, setInstallProgress] = useState({ percent: 0, message: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const loadGames = async () => {
      const g = await (window as any).api?.getGames?.();
      if (g) {
        setGames(g);
        if (g.length > 0) {
          setSelectedGameId(g[0].id);
        }
      }
    };
    loadGames();
    
    (window as any).api?.onInstallProgress?.((data: any) => {
      setInstallProgress(data);
    });
  }, []);

  const selectedGame = games.find(g => g.id === selectedGameId);
  const selectedVariant = selectedGame?.variants?.[selectedVariantIdx];

  const handleNextStep1 = async () => {
    setStep(2);
    setIsSearching(true);
    if (selectedGame) {
      const foundPath = await (window as any).api?.findGame?.(selectedGame.steamAppId, selectedGame.exeName);
      setGamePath(foundPath);
    }
    setIsSearching(false);
  };

  const handleBrowse = async () => {
    const path = await (window as any).api?.browseExe?.();
    if (path) {
      setGamePath(path);
    }
  };

  const handleInstall = async () => {
    setStep(3);
    setInstallProgress({ percent: 0, message: 'Starting installation...' });
    if (gamePath && selectedVariant) {
      await (window as any).api?.install?.(gamePath, selectedVariant.archiveName);
      await (window as any).api?.saveStoredGamePath?.(gamePath);
    }
    setStep(4);
  };
  
  const handleUpdateScripts = async () => {
    if (gamePath) {
      setIsUpdating(true);
      setInstallProgress({ percent: 0, message: 'Updating scripts...' });
      await (window as any).api?.updateScripts?.(gamePath);
      setIsUpdating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="bg-pixel-panel border-4 border-pixel-border rounded-lg shadow-pixel p-6 relative h-full flex flex-col items-center justify-center font-mono"
    >
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38bIxsDBBgAEGAAZTwF85bZzQ8AAAAASUVORK5CYII=')]"></div>

      <div className="relative z-10 w-full max-w-md bg-pixel-void border-2 border-pixel-muted p-6 rounded shadow-pixel">
        <h2 className="text-xl font-bold text-pixel-light mb-4 text-center border-b-2 border-pixel-muted pb-2">
          Setup Wizard - Step {step}/4
        </h2>
        
        <div className="relative min-h-[250px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              {step === 1 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-pixel-cyan mb-2 text-sm uppercase">Select Game:</label>
                    <select 
                      className="w-full bg-pixel-panel text-pixel-light border border-pixel-border p-2 outline-none focus:shadow-[0_0_10px_rgba(0,255,255,0.3)] transition-shadow"
                      value={selectedGameId}
                      onChange={(e) => {
                        setSelectedGameId(e.target.value);
                        setSelectedVariantIdx(0);
                      }}
                    >
                      {games.map(g => (
                        <option key={g.id} value={g.id}>{g.displayName}</option>
                      ))}
                    </select>
                  </div>

                  {selectedGame && selectedGame.variants && selectedGame.variants.length > 1 && (
                    <div className="mt-2">
                      <label className="block text-pixel-cyan mb-2 text-sm uppercase">Select Variant:</label>
                      <div className="flex flex-col gap-2">
                        {selectedGame.variants.map((v, idx) => (
                          <label key={idx} className="flex items-start gap-2 cursor-pointer text-sm text-pixel-light hover:text-pixel-cyan transition-colors">
                            <input 
                              type="radio" 
                              name="variant" 
                              className="mt-1 accent-pixel-cyan"
                              checked={selectedVariantIdx === idx}
                              onChange={() => setSelectedVariantIdx(idx)}
                            />
                            <div className="flex flex-col">
                              <span>{v.label}</span>
                              {v.tooltip && <span className="text-xs text-pixel-muted">{v.tooltip}</span>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    className="mt-4 w-full bg-pixel-cyan hover:bg-[#3498db] text-pixel-void font-bold py-2 border-2 border-pixel-light shadow-pixel hover:translate-y-[2px] transition-all hover:shadow-[0_0_15px_rgba(0,255,255,0.5)]"
                    onClick={handleNextStep1}
                  >
                    Find Game →
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-4">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-8 text-pixel-cyan">
                      <Loader2 className="animate-spin mb-2" size={32} />
                      <span className="animate-pulse">Searching...</span>
                    </div>
                  ) : (
                    <>
                      {gamePath ? (
                        <div className="bg-[#103010] border-2 border-green-500 p-3 rounded text-sm text-green-400 break-all shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                          ✓ Found: {gamePath}
                        </div>
                      ) : (
                        <div className="bg-[#302010] border-2 border-pixel-amber p-3 rounded text-sm text-pixel-amber shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                          ! Game not found automatically.
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-3 mt-4">
                        <div className="flex gap-2">
                          <button 
                            className="flex-1 bg-pixel-muted hover:bg-pixel-border text-pixel-light font-bold py-2 border-2 border-pixel-light shadow-pixel transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                            onClick={handleBrowse}
                          >
                            <div className="flex justify-center items-center gap-2">
                              <FolderSearch size={16} /> 
                              <span className="text-xs">{gamePath ? "Change Path" : "Browse..."}</span>
                            </div>
                          </button>
                          <button 
                            className={`flex-1 font-bold py-2 border-2 border-pixel-light shadow-pixel transition-all ${gamePath ? 'bg-pixel-cyan hover:bg-[#3498db] text-pixel-void hover:shadow-[0_0_15px_rgba(0,255,255,0.5)]' : 'bg-pixel-void text-pixel-muted cursor-not-allowed opacity-50'}`}
                            onClick={handleInstall}
                            disabled={!gamePath}
                          >
                            Install →
                          </button>
                        </div>
                        
                        {gamePath && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center mt-1"
                          >
                            <button
                              className="w-full bg-pixel-void hover:bg-pixel-muted text-pixel-light/80 hover:text-pixel-light font-bold py-1.5 border border-pixel-light/50 border-dashed rounded shadow-pixel transition-all hover:shadow-[0_0_10px_rgba(255,255,255,0.2)] text-xs"
                              onClick={async () => {
                                await (window as any).api?.saveStoredGamePath?.(gamePath);
                                onComplete();
                              }}
                            >
                              Skip (Already Configured)
                            </button>
                            <span className="text-[10px] text-pixel-muted mt-1.5 text-center px-2">
                              Если REFramework уже установлен, просто пропустите шаг.
                            </span>
                          </motion.div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-4 py-4">
                  <motion.div 
                    animate={{ opacity: [0.5, 1, 0.5] }} 
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-pixel-cyan text-sm mb-2 text-center"
                  >
                    {installProgress.message}
                  </motion.div>
                  <div className="h-4 w-full bg-pixel-void border border-pixel-cyan/50 rounded overflow-hidden shadow-[0_0_10px_rgba(0,255,255,0.2)]">
                    <div 
                      className="h-full bg-pixel-cyan transition-all duration-300 relative" 
                      style={{ width: `${installProgress.percent}%` }}
                    >
                      <div className="absolute inset-0 bg-white/30 animate-[shimmer_1s_infinite]"></div>
                    </div>
                  </div>
                  <div className="text-center text-xs text-pixel-cyan font-bold mt-2 animate-pulse">
                    {installProgress.percent}%
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="flex flex-col gap-4 items-center text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  >
                    <Check size={48} className="text-green-500 mb-2 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]" />
                  </motion.div>
                  <p className="text-sm text-pixel-light">RE:Control successfully installed! Launch the game, then press Start Crowd Control.</p>
                  
                  {isUpdating && (
                    <div className="w-full mt-2">
                      <div className="text-pixel-cyan text-xs mb-1">{installProgress.message}</div>
                      <div className="h-2 w-full bg-pixel-void border border-pixel-muted rounded overflow-hidden">
                        <div 
                          className="h-full bg-pixel-cyan transition-all duration-300" 
                          style={{ width: `${installProgress.percent}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <button 
                    className="mt-4 w-full bg-green-600 hover:bg-green-500 text-pixel-void font-bold py-2 border-2 border-pixel-light shadow-pixel transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                    onClick={onComplete}
                    disabled={isUpdating}
                  >
                    Open Control Panel
                  </button>
                  <button 
                    className="w-full bg-pixel-muted hover:bg-pixel-border text-pixel-light font-bold py-2 border-2 border-pixel-light shadow-pixel transition-all flex justify-center items-center gap-2 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                    onClick={handleUpdateScripts}
                    disabled={isUpdating}
                  >
                    <RefreshCw size={14} className={isUpdating ? "animate-spin" : ""} />
                    <span className="text-xs">Update Scripts</span>
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};


