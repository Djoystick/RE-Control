import re
with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "r", encoding="utf-8") as f:
    text = f.read()

# Add combo state variables
class_start = r"export class VotingManager extends EventEmitter {"
class_new = """export class VotingManager extends EventEmitter {
    private lastVoteOptionId: number | null = null;
    private comboCount: number = 0;"""
text = text.replace(class_start, class_new)

# Reset combo state on startCycle
start_cycle = r"this.isActive = true;"
start_cycle_new = """this.isActive = true;
        this.lastVoteOptionId = null;
        this.comboCount = 0;"""
text = text.replace(start_cycle, start_cycle_new)

# Handle command combo logic
handle_cmd_old = r"""        const option = this.options.find(o => o.id === optionId);
        if (option) {
            option.votes += 1;"""

handle_cmd_new = r"""        const option = this.options.find(o => o.id === optionId);
        if (option) {
            option.votes += 1;
            
            if (this.lastVoteOptionId === optionId) {
                this.comboCount++;
                if (this.comboCount >= 5 && !(option as any).isMega) {
                    (option as any).isMega = true;
                    option.displayName = `🔥 MEGA: ${option.displayName} 🔥`;
                    sysLogger.info(`MEGA COMBO achieved for option ${optionId}!`);
                    this.emit('vote:combo', option);
                }
            } else {
                this.lastVoteOptionId = optionId;
                this.comboCount = 1;
            }
"""
text = text.replace(handle_cmd_old, handle_cmd_new)

# Update the vote:end logic to send MEGA prefix
end_vote_old = r"""this.emit('vote:end', { winner, state: this.getState() });"""
end_vote_new = r"""
        if ((winner as any).isMega) {
            winner.effectId = 'MEGA_' + winner.effectId;
        }
        this.emit('vote:end', { winner, state: this.getState() });"""
text = text.replace(end_vote_old, end_vote_new)

with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated VotingManager with Chain Combos")
