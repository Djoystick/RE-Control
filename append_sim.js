const fs = require('fs');

const code = `  return (
    <div className="bg-pixel-panel border border-pixel-border rounded-lg shadow-pixel p-4 relative h-full grid grid-cols-12 gap-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38bIxsDBBgAEGAAZTwF85bZzQ8AAAAASUVORK5CYII=')]"></div>
      
      {/* LEFT COLUMN: Controls */}
      <div className="col-span-5 flex flex-col gap-3 relative z-10 overflow-hidden bg-pixel-void/40 p-3 rounded border border-pixel-border/50 h-full">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-pixel-muted pb-2 flex-shrink-0">
          <Terminal className="text-pixel-amber" size={18} />
          <h2 className="text-[16px] font-bold text-pixel-light truncate">Контроль голосования</h2>
          <div className="flex-1 flex items-center justify-end gap-1 opacity-50 hidden sm:flex">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={\`dot-\${i}\`}
                className="w-1.5 h-1.5 bg-pixel-light rounded-full"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 pb-1">
          {/* Start / Stop Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center justify-center gap-1 bg-pixel-panel/50 hover:bg-pixel-amber/20 text-pixel-amber border border-pixel-amber/30 p-2 rounded transition-colors"
              onClick={() => window.api?.startVoting?.()}
            >
              <Play size={16} />
              <span className="text-[10px] uppercase font-bold tracking-wider">Start Event</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center justify-center gap-1 bg-pixel-panel/50 hover:bg-pixel-danger/20 text-pixel-danger border border-pixel-danger/30 p-2 rounded transition-colors"
              onClick={() => window.api?.stopVoting?.()}
            >
              <Square size={16} />
              <span className="text-[10px] uppercase font-bold tracking-wider">Stop Event</span>
            </motion.button>
          </div>
          
          {/* Pacing */}
          <div>
            <label className="text-[10px] font-bold text-pixel-light/70 uppercase mb-1 flex items-center gap-1">
              <Clock size={12} /> Event Pacing (Cooldown)
            </label>
            <select 
              className="w-full bg-pixel-void border border-pixel-muted text-pixel-cyan text-xs p-1 rounded outline-none"
              onChange={(e) => window.api?.updateSettings?.({ cooldownMs: parseInt(e.target.value) })}
              defaultValue="600000"
            >
              <option value="60000">1 Minute (TESTING)</option>
              <option value="300000">5 Minutes</option>
              <option value="600000">10 Minutes (DEFAULT)</option>
              <option value="900000">15 Minutes</option>
              <option value="1200000">20 Minutes</option>
            </select>
          </div>

          {/* Traitor Button */}
          <div className="border-t border-pixel-muted/30 pt-3">
            <motion.button
              whileHover={{ scale: (trustedCount > 0 && !traitorState?.active) ? 1.02 : 1 }}
              whileTap={{ scale: (trustedCount > 0 && !traitorState?.active) ? 0.95 : 1 }}
              className={\`w-full flex items-center justify-center gap-2 text-pixel-light font-bold py-2 px-3 border border-pixel-danger/50 rounded shadow-[0_0_10px_rgba(255,0,0,0.2)] transition-all \${
                (trustedCount > 0 && !traitorState?.active)
                  ? 'bg-pixel-danger/80 hover:bg-pixel-danger' 
                  : 'bg-pixel-muted/50 opacity-50 cursor-not-allowed'
              }\`}
              onClick={() => window.api?.invokeTraitor?.()}
              disabled={trustedCount === 0 || traitorState?.active}
            >
              <Skull className={trustedCount > 0 && !traitorState?.active ? "animate-pulse text-red-300" : ""} size={16} />
              <span className="text-xs uppercase tracking-wide">Invoke Traitor</span>
              {trustedCount > 0 && (
                <span className="bg-pixel-void text-pixel-light text-[10px] px-1.5 py-0.5 rounded ml-1 shadow-[inset_0_0_5px_rgba(255,0,0,0.5)]">
                  {trustedCount}
                </span>
              )}
            </motion.button>
          </div>

          {/* Twitch Connect Box */}
          <div className="mt-2 border-t border-[#6441a5]/50 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Radar className="text-[#6441a5]" size={14} />
              <h3 className="text-xs font-bold text-pixel-light/90 uppercase">Twitch Connection</h3>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-pixel-light/70 text-[10px] font-bold uppercase mb-0.5">Channel</label>
                  <input 
                    type="text" 
                    placeholder="lirik" 
                    className="w-full bg-pixel-void/50 border-b border-pixel-muted text-pixel-cyan px-2 py-1 font-mono text-xs outline-none focus:border-pixel-cyan focus:bg-pixel-void transition-colors"
                    value={twitchChannel}
                    onChange={(e) => setTwitchChannel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-pixel-light/70 text-[10px] font-bold uppercase mb-0.5">Bot Username</label>
                  <input 
                    type="text" 
                    className="w-full bg-pixel-void/50 border-b border-pixel-muted text-pixel-cyan px-2 py-1 font-mono text-xs outline-none focus:border-pixel-cyan focus:bg-pixel-void transition-colors"
                    value={botUsername}
                    onChange={(e) => setBotUsername(e.target.value)}
                    placeholder="my_cool_bot"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-pixel-light/70 text-[10px] font-bold uppercase mb-0.5">OAuth Token</label>
                <input 
                  type="password" 
                  className="w-full bg-pixel-void/50 border-b border-pixel-muted text-pixel-cyan px-2 py-1 font-mono text-xs outline-none focus:border-pixel-cyan focus:bg-pixel-void transition-colors"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="oauth:..."
                />
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 mt-1 bg-pixel-void/50 border border-pixel-muted/30 p-1.5 rounded">
                {twitchStatus?.connected ? (
                  <>
                    {twitchStatus?.botAuthenticated ? (
                      <CheckCircle2 size={12} className="text-green-400" />
                    ) : (
                      <Loader2 size={12} className="text-yellow-400 animate-spin" />
                    )}
                    <span className={\`text-[10px] font-mono font-bold \${twitchStatus?.botAuthenticated ? 'text-green-400 animate-pulse' : 'text-yellow-400'}\`}>
                      {twitchStatus?.botAuthenticated ? 'BOT AUTHENTICATED' : 'CONNECTED (READ-ONLY)'}
                    </span>
                  </>
                ) : (
                  <>
                    {tokenStatus === 'validating' && <Loader2 size={12} className="text-yellow-400 animate-spin" />}
                    {tokenStatus === 'valid' && <CheckCircle2 size={12} className="text-green-400" />}
                    {tokenStatus === 'invalid' && <XCircle size={12} className="text-red-400" />}
                    {tokenStatus === 'idle' && <Radio size={12} className="text-pixel-light/70" />}
                    
                    <span className={\`text-[10px] font-mono font-bold \${
                      tokenStatus === 'validating' ? 'text-yellow-400' :
                      tokenStatus === 'valid' ? 'text-green-400 animate-pulse' :
                      tokenStatus === 'invalid' ? 'text-red-400' :
                      'text-pixel-light/70'
                    }\`}>
                      {tokenStatus === 'validating' && 'VALIDATING TOKEN...'}
                      {tokenStatus === 'valid' && 'READY (BOT AUTHENTICATED)'}
                      {tokenStatus === 'invalid' && 'INVALID TOKEN'}
                      {tokenStatus === 'idle' && 'READY (READ-ONLY)'}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-2">
                {!twitchStatus?.connected ? (
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(145,70,255,0.8)' }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full flex items-center justify-center gap-2 bg-[#6441a5] text-pixel-light font-bold py-1.5 px-3 border border-pixel-light/50 rounded text-xs shadow-[0_0_5px_rgba(145,70,255,0.5)]"
                    onClick={() => {
                      if (window.api?.saveTwitchAuth) {
                        window.api.saveTwitchAuth(botUsername, botToken, twitchChannel);
                      }
                      window.api?.connectTwitch?.(twitchChannel);
                    }}
                  >
                    Connect
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: '0 0 10px rgba(156,163,175,0.6)' }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full flex items-center justify-center gap-2 bg-pixel-muted/50 text-pixel-light font-bold py-1.5 px-3 border border-pixel-light/50 rounded text-xs"
                    onClick={() => window.api?.disconnectTwitch?.()}
                  >
                    Disconnect
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column (Data/State) */}
      <div className="col-span-7 h-full flex flex-col gap-3 overflow-hidden relative z-10">
        {/* Voting UI at the top */}
        <div className="flex-shrink-0">
          {renderVotingUI()}
        </div>

        {/* Top Karma & Logs at the bottom */}
        <div className="flex gap-3 flex-1 min-h-0">
          <div className="w-1/3 bg-gradient-to-b from-pixel-void to-pixel-void/80 border border-pixel-muted/50 p-2 rounded text-xs text-pixel-cyan font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden after:content-[''] after:absolute after:inset-0 after:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38bIxsDBBgAEGAAZTwF85bZzQ8AAAAASUVORK5CYII=')] after:opacity-10 after:pointer-events-none">
            <h3 className="text-pixel-amber font-bold mb-2 border-b border-pixel-amber/30 pb-1 text-center text-[10px] uppercase relative z-10">Top Karma</h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar min-h-0 pr-1 relative z-10">
              {(!leaderboard || leaderboard.length === 0) ? (
                <div className="text-pixel-muted/50 text-center text-[10px] mt-2">No data...</div>
              ) : (
                leaderboard.map((viewer, idx) => (
                  <div key={viewer?.username || idx} className="flex justify-between items-center mb-1.5">
                    <span className="text-pixel-light/80 truncate pr-1 text-[10px]">{idx + 1}. {viewer?.username}</span>
                    <span className="text-pixel-cyan font-bold bg-pixel-panel/50 px-1 border border-pixel-muted/30 text-[10px] rounded-sm">{viewer?.karma}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="w-2/3 bg-gradient-to-b from-pixel-void to-pixel-void/80 border border-pixel-muted/50 p-2 rounded text-xs text-pixel-cyan font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] relative flex flex-col min-h-0 overflow-hidden after:content-[''] after:absolute after:inset-0 after:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38bIxsDBBgAEGAAZTwF85bZzQ8AAAAASUVORK5CYII=')] after:opacity-10 after:pointer-events-none">
            <h3 className="text-pixel-light/50 font-bold mb-1 border-b border-pixel-border/30 pb-1 text-[10px] uppercase relative z-10">System Logs</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-1 text-[10px] relative z-10">
              {(logs || []).map((log, index) => (
                <div key={index} className="mb-1.5 break-all border-b border-pixel-border/20 pb-1 flex flex-col gap-0.5">
                  <div className="text-[9px] text-pixel-light/30">{new Date().toLocaleTimeString()}</div>
                  <div className="flex items-start">
                    {log?.type === 'system' ? (
                      <span className="text-pixel-danger font-bold opacity-100">{log?.message}</span>
                    ) : (
                      <>
                        <span className="text-pixel-amber mr-1">{'>'}</span>
                        <span className="opacity-70 text-pixel-light/60">{log?.username}: </span>
                        <span className="opacity-90 ml-1 text-pixel-cyan font-bold">{log?.command}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
`;

fs.appendFileSync('src/renderer/src/components/SimulatorPanel.tsx', code);
