import re
with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

pattern = r"""onClick=\{\(\) => \(window as any\)\.api\?\.simulateDonation\?\.\(500\)\}\s*>\s*👑 500₽\s*</motion\.button>\s*</div>"""

replacement = r"""onClick={() => (window as any).api?.simulateDonation?.(500)}
                  >
                     👑 500₽
                  </motion.button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs uppercase font-bold py-2 rounded flex items-center justify-center gap-2 shadow-[0_0_5px_rgba(249,115,22,0.3)] transition-colors mt-2"
                  onClick={() => (window as any).api?.simulatorCombo?.(1)}
                >
                   🔥 ЗАПУСТИТЬ ЦЕПНОЕ КОМБО (x5)
                </motion.button>"""

text = re.sub(pattern, replacement, text)

with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
print("Injected!")
