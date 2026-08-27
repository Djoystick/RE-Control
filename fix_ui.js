const fs = require('fs');
let lines = fs.readFileSync('H:/Work/RE_Control/src/renderer/src/components/SimulatorPanel.tsx', 'utf8').split('\n');

const buttonCode = [
  '        <button',
  '          className={',
  '            "flex-1 flex items-center justify-center gap-2 text-pixel-light font-bold py-3 px-4 border-2 border-pixel-light shadow-pixel transition-all " +',
  '            (twitchStatus.connected ? "bg-pixel-cyan text-pixel-void" : "bg-[#6441a5] hover:bg-[#9146FF]")',
  '          }',
  '          onClick={() => window.api.connectTwitch(twitchChannel)}',
  '          disabled={twitchStatus.connected}',
  '        >',
  '          <span>{twitchStatus.connected ? "Connected: #" + twitchStatus.channel : "Connect Twitch"}</span>',
  '        </button>'
];

lines.splice(129, 6, ...buttonCode);
fs.writeFileSync('H:/Work/RE_Control/src/renderer/src/components/SimulatorPanel.tsx', lines.join('\n'));
