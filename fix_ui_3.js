const fs = require('fs');
let c = fs.readFileSync('H:/Work/RE_Control/src/renderer/src/components/SimulatorPanel.tsx', 'utf8');

c = c.replace(/<button\n\s*<button/, '<button');
fs.writeFileSync('H:/Work/RE_Control/src/renderer/src/components/SimulatorPanel.tsx', c);
