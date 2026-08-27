import re
with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "r", encoding="utf-8") as f:
    text = f.read()

# Fix getState
state_old = r"""    getState(): VoteState {
        const totalVotes = this.options.reduce((sum, opt) => sum + opt.votes, 0);
        return {
            isActive: this.isActive,
            options: this.options,
            timeRemainingMs: this.timeRemainingMs,
            totalVotes
        };
    }"""
state_new = r"""    getState(): VoteState {
        const totalVotes = this.options.reduce((sum, opt) => sum + opt.votes, 0);
        return {
            isActive: this.isActive,
            options: this.options,
            timeRemainingMs: this.timeRemainingMs,
            totalVotes,
            intervention: this.interventionState
        };
    }"""
text = text.replace(state_old, state_new)

# Inject rollIntervention before the final closing brace
class_end_target = r"    }" + "\n" + r"}"
roll_intervention = r"""    }

    public rollIntervention(force: boolean = false) {
        if (!this.isActive) return;
        
        // 30% chance
        if (!force && Math.random() > 0.3) {
            sysLogger.info('Intervention rolled: No intervention this time.');
            return; 
        }

        const interventions = ['veto', 'invert', 'blind', 'equalize', 'turbo'];
        const chosen = interventions[Math.floor(Math.random() * interventions.length)];
        
        sysLogger.info(`Intervention rolled: ${chosen}!`);

        let message = '';

        switch (chosen) {
            case 'veto':
                this.options.sort((a, b) => b.votes - a.votes);
                const removed = this.options.shift();
                message = `🛑 ВЕТО АМБРЕЛЛЫ! Лидирующая опция [${removed?.displayName}] удалена!`;
                break;
            case 'invert':
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
                message = `🙈 СЛЕПАЯ ЗОНА! Прогресс голосования скрыт!`;
                break;
            case 'equalize':
                const total = this.options.reduce((sum, o) => sum + o.votes, 0);
                const avg = Math.floor(total / Math.max(1, this.options.length));
                this.options.forEach(o => o.votes = avg);
                message = `⚖️ УРАВНИТЕЛЬ! Все голоса сброшены к среднему значению!`;
                break;
            case 'turbo':
                this.timeRemainingMs = 5000;
                message = `🚀 РЕЖИМ ТУРБО! Время истекает! Голосование завершится через 5 секунд!`;
                break;
        }

        this.interventionState = { type: chosen, message };
        this.emit('vote:intervention', this.interventionState);
        this.emit('vote:update', this.getState());
    }
}"""
text = text.replace(class_end_target, roll_intervention)

with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Fixed missing rollIntervention")
