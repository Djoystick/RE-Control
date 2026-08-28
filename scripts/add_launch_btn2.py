with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

import re
old_block = r"\{\/\* Start \/ Stop Buttons \*\/\}\s*<div className=.grid grid-cols-2 gap-2 mt-1.>"
new_block = """{/* Launch Game Button */}
                  <motion.button
                    whileHover={{ filter: 'brightness(1.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-pixel-cyan/10 hover:bg-pixel-cyan/20 border border-pixel-cyan/50 text-pixel-cyan text-xs uppercase font-bold py-2 rounded flex items-center justify-center gap-2 shadow-[0_0_5px_rgba(34,211,238,0.3)] transition-colors mt-1"
                    onClick={() => (window as any).api?.launchGame?.()}
                  >
                     🎮 ЗАПУСТИТЬ ИГРУ
                  </motion.button>

                  {/* Start / Stop Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-2">"""

text = re.sub(old_block, new_block, text)

with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
