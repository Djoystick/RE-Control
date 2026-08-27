import re
with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Remove old combo state
text = text.replace("private lastVoteOptionId: number | null = null;", "")
text = text.replace("private comboCount: number = 0;", "private interventionTimer: NodeJS.Timeout | null = null;\n    private interventionState: any = null;")
text = text.replace("this.lastVoteOptionId = null;", "")
text = text.replace("this.comboCount = 0;", "this.interventionState = null;")

# 2. Add intervention timer to startCycle
start_cycle_old = r"""this.timer = setInterval(() => {"""
start_cycle_new = r"""
        // 30% chance for an intervention exactly halfway through
        this.interventionTimer = setTimeout(() => {
            this.rollIntervention();
        }, this.VOTE_DURATION_MS / 2);

        this.timer = setInterval(() => {"""
text = text.replace(start_cycle_old, start_cycle_new)

# 3. Add clear intervention timer to stop and endVote
stop_old = r"""if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }"""
stop_new = r"""if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        if (this.interventionTimer) { clearTimeout(this.interventionTimer); this.interventionTimer = null; }"""
text = text.replace(stop_old, stop_new)

# 4. Remove old handleChatCommand combo logic and just leave votes++
handle_old = r"""            if (option) {
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

                // Add karma"""
handle_new = r"""            if (option) {
                option.votes++;

                // Add karma"""
text = text.replace(handle_old, handle_new)

# 5. Add rollIntervention method and update getState
class_end_old = r"""    getState() {
        return {
            isActive: this.isActive,
            options: this.options,
            timeRemainingMs: this.timeRemainingMs
        };
    }
}"""
class_end_new = r"""    getState() {
        return {
            isActive: this.isActive,
            options: this.options,
            timeRemainingMs: this.timeRemainingMs,
            intervention: this.interventionState
        };
    }

    private rollIntervention() {
        if (!this.isActive) return;
        
        // Let's make it 30% chance
        if (Math.random() > 0.3) {
            sysLogger.info('Intervention rolled: No intervention this time.');
            return; 
        }

        const interventions = ['veto', 'invert', 'blind', 'equalize'];
        const chosen = interventions[Math.floor(Math.random() * interventions.length)];
        
        sysLogger.info(`Intervention rolled: ${chosen}!`);

        let message = '';

        switch (chosen) {
            case 'veto':
                // Remove the currently winning option
                this.options.sort((a, b) => b.votes - a.votes);
                const removed = this.options.shift();
                message = `🛑 ВЕТО АМБРЕЛЛЫ! Лидирующая опция [${removed?.displayName}] удалена!`;
                break;
            case 'invert':
                // Swap votes between 1st and last place
                this.options.sort((a, b) => b.votes - a.votes);
                if (this.options.length >= 2) {
                    const first = this.options[0];
                    const last = this.options[this.options.length - 1];
                    const temp = first.votes;
                    first.votes = last.votes;
                    last.votes = temp;
                }
                message = `🔄 ИНВЕРСИЯ! Голоса лидера и аутсайдера поменялись местами!`;
                break;
            case 'blind':
                // Just tell UI to hide progress bars
                message = `🙈 СЛЕПАЯ ЗОНА! Прогресс голосования скрыт!`;
                break;
            case 'equalize':
                // Set all votes to the average
                const total = this.options.reduce((sum, o) => sum + o.votes, 0);
                const avg = Math.floor(total / this.options.length);
                this.options.forEach(o => o.votes = avg);
                message = `⚖️ УРАВНИТЕЛЬ! Все голоса сброшены к среднему значению!`;
                break;
        }

        this.interventionState = { type: chosen, message };
        this.emit('vote:intervention', this.interventionState);
        this.emit('vote:update', this.getState());
    }
}"""
text = text.replace(class_end_old, class_end_new)

with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Implemented InterventionEngine")
