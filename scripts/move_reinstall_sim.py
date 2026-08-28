with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Add the prop
text = text.replace("export const SimulatorPanel: React.FC = () => {", "export const SimulatorPanel: React.FC<{ onReinstall?: () => void }> = ({ onReinstall }) => {")

# Add the button to settings tab
settings_content = """                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-pixel-cyan/10 hover:bg-pixel-cyan/20 border border-pixel-cyan/50 text-pixel-cyan text-xs uppercase font-bold py-1.5 rounded mt-2 shadow-[0_0_5px_rgba(34,211,238,0.3)] transition-colors"
                      onClick={() => window.api?.saveHotkeys?.(hotkeys)}
                    >
                      Save Settings
                    </motion.button>
                  </div>
                </div>

                {/* System Settings */}
                <div className="border-t border-pixel-muted/30 pt-3 mt-1">
                  <h3 className="text-xs font-bold text-pixel-light/90 uppercase mb-2 text-pixel-danger">Danger Zone</h3>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-pixel-danger/10 hover:bg-pixel-danger border border-pixel-danger/50 hover:border-pixel-danger text-pixel-danger hover:text-pixel-void text-xs uppercase font-bold py-1.5 rounded transition-colors"
                    onClick={() => onReinstall && onReinstall()}
                  >
                    ⚙️ Reinstall Game Bridge
                  </motion.button>
                </div>"""

text = text.replace("""                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-pixel-cyan/10 hover:bg-pixel-cyan/20 border border-pixel-cyan/50 text-pixel-cyan text-xs uppercase font-bold py-1.5 rounded mt-2 shadow-[0_0_5px_rgba(34,211,238,0.3)] transition-colors"
                      onClick={() => window.api?.saveHotkeys?.(hotkeys)}
                    >
                      Save Settings
                    </motion.button>
                  </div>
                </div>""", settings_content)

with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
