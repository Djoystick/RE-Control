import re
with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Replace whileHover={{ scale: x.xx }} with whileHover={{ filter: 'brightness(1.2)' }}
text = re.sub(r'whileHover=\{\{\s*scale:\s*[\d\.]+\s*\}\}', "whileHover={{ filter: 'brightness(1.2)' }}", text)

# Just in case some have strings
text = re.sub(r'whileTap=\{\{\s*scale:\s*[\d\.]+\s*\}\}', "whileTap={{ scale: 0.98 }}", text)

with open(r"H:\Work\RE_Control\src\renderer\src\components\SimulatorPanel.tsx", "w", encoding="utf-8") as f:
    f.write(text)
print("Removed hover scale animations")
