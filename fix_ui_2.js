const fs = require('fs');
let c = fs.readFileSync('H:/Work/RE_Control/src/renderer/src/components/SimulatorPanel.tsx', 'utf8');

const regex = /<button[\s\S]*?className=\{[\s\S]*?onClick=\{\(\) => window.api.connectTwitch\(twitchChannel\)\}[\s\S]*?<\/button>/;

const replacement = <button
          className={
            "flex-1 flex items-center justify-center gap-2 text-pixel-light font-bold py-3 px-4 border-2 border-pixel-light shadow-pixel transition-all " +
            (twitchStatus.connected ? "bg-pixel-cyan text-pixel-void" : "bg-[#6441a5] hover:bg-[#9146FF]")
          }
          onClick={() => window.api.connectTwitch(twitchChannel)}
          disabled={twitchStatus.connected}
        >
          <span>{twitchStatus.connected ? "Connected: #" + twitchStatus.channel : "Connect Twitch"}</span>
        </button>;

c = c.replace(regex, replacement);
fs.writeFileSync('H:/Work/RE_Control/src/renderer/src/components/SimulatorPanel.tsx', c);
