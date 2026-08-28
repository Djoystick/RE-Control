with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

traitor_block = """                {/* Traitor Button */}
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
                </div>"""

# Remove from Debug tab
text = text.replace(traitor_block, "")

# Add to Control tab right after Start/Stop Buttons
import re
text = re.sub(r"\{\/\* Start \/ Stop Buttons \*\/\}\s*<div className=.grid grid-cols-2 gap-2 mt-2.>\s*<motion\.button[\s\S]*?<\/div>", lambda m: m.group(0) + "\n\n" + traitor_block, text)

with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
