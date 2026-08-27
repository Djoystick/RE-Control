import re
with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("🔥 ЗАПУСТИТЬ ЦЕПНОЕ КОМБО (x5)", "🚨 ВМЕШАТЕЛЬСТВО АМБРЕЛЛЫ")
text = text.replace("onClick={() => (window as any).api?.simulatorCombo?.(1)}", "onClick={() => (window as any).api?.simulatorCombo?.()}")

with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated button text")
