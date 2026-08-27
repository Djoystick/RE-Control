import re
with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Let's find the closing tag of the div containing the donation buttons, or just before the Invoke Traitor button.
# Looking for:
#                 </div>
#                 
#                 {/* TRAITOR INVOCATION */}

target = r"""                </div>

                {/* TRAITOR INVOCATION */}"""

new_buttons = r"""                </div>

                {/* TEST COMBO BUTTON */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs uppercase font-bold py-2 rounded flex items-center justify-center gap-2 shadow-[0_0_5px_rgba(249,115,22,0.3)] transition-colors mt-2"
                  onClick={() => (window as any).api?.simulatorCombo?.(1)}
                >
                   🔥 ЗАПУСТИТЬ ЦЕПНОЕ КОМБО (x5)
                </motion.button>

                {/* TRAITOR INVOCATION */}"""

text = text.replace(target, new_buttons)

with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated UI properly")
