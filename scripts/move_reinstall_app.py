with open(r"H:\Work\RE_Control\src\renderer\src\App.tsx", "r", encoding="utf-8") as f:
    text = f.read()

import re

# Remove the absolute Reinstall button
button_pattern = r'<button[^>]*onClick=\{\(\) => setSetupDone\(false\)\}[^>]*>[\s\S]*?<\/button>'
text = re.sub(button_pattern, '', text)

# Pass the prop to SimulatorPanel
text = text.replace("<SimulatorPanel />", "<SimulatorPanel onReinstall={() => setSetupDone(false)} />")

with open(r"H:\Work\RE_Control\src\renderer\src\App.tsx", "w", encoding="utf-8") as f:
    f.write(text)
