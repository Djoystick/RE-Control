import re
with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

target = r"""                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 text-xs uppercase font-bold py-3 rounded flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-colors"
                    onClick={() => (window as any).api?.invokeTraitor?.()}
                  >
                    <Skull size={16} /> INVOKE TRAITOR <span className="bg-red-500/20 px-2 py-0.5 rounded ml-2">1</span>
                  </motion.button>"""

new_buttons = r"""                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs uppercase font-bold py-2 rounded flex items-center justify-center gap-2 shadow-[0_0_5px_rgba(249,115,22,0.3)] transition-colors"
                    onClick={() => (window as any).api?.simulatorCombo?.(1)}
                  >
                     🔥 ЗАПУСТИТЬ ЦЕПНОЕ КОМБО (x5)
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 text-xs uppercase font-bold py-3 rounded flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-colors"
                    onClick={() => (window as any).api?.invokeTraitor?.()}
                  >
                    <Skull size={16} /> INVOKE TRAITOR <span className="bg-red-500/20 px-2 py-0.5 rounded ml-2">1</span>
                  </motion.button>"""

text = text.replace(target, new_buttons)

with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated UI")
