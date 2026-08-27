import re
with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "r", encoding="utf-8") as f:
    text = f.read()

target = r"""            const option = this.options.find(opt => opt.id === voteId);
            if (option) {
                option.votes++;
                // Add karma
                dbManager.addVote(cmd.username, option.effectId);
                
                this.emit('vote:update', this.getState());
            }"""

replacement = r"""            const option = this.options.find(opt => opt.id === voteId);
            if (option) {
                option.votes++;
                
                if (this.lastVoteOptionId === voteId) {
                    this.comboCount++;
                    if (this.comboCount >= 5 && !(option as any).isMega) {
                        (option as any).isMega = true;
                        option.displayName = `🔥 MEGA: ${option.displayName} 🔥`;
                        sysLogger.info(`MEGA COMBO achieved for option ${voteId}!`);
                        this.emit('vote:combo', option);
                    }
                } else {
                    this.lastVoteOptionId = voteId;
                    this.comboCount = 1;
                }

                // Add karma
                dbManager.addVote(cmd.username, option.effectId);
                
                this.emit('vote:update', this.getState());
            }"""

text = text.replace(target, replacement)

with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Injected logic properly")
