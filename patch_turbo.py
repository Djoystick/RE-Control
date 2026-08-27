import re
with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "r", encoding="utf-8") as f:
    text = f.read()

old_array = r"const interventions = ['veto', 'invert', 'blind', 'equalize'];"
new_array = r"const interventions = ['veto', 'invert', 'blind', 'equalize', 'turbo'];"
text = text.replace(old_array, new_array)

old_switch = r"""            case 'equalize':
                // Set all votes to the average
                const total = this.options.reduce((sum, o) => sum + o.votes, 0);
                const avg = Math.floor(total / this.options.length);
                this.options.forEach(o => o.votes = avg);
                message = `⚖️ УРАВНИТЕЛЬ! Все голоса сброшены к среднему значению!`;
                break;
        }"""
new_switch = r"""            case 'equalize':
                // Set all votes to the average
                const total = this.options.reduce((sum, o) => sum + o.votes, 0);
                const avg = Math.floor(total / Math.max(1, this.options.length));
                this.options.forEach(o => o.votes = avg);
                message = `⚖️ УРАВНИТЕЛЬ! Все голоса сброшены к среднему значению!`;
                break;
            case 'turbo':
                // Fast-forward the timer to 5 seconds
                this.timeRemainingMs = 5000;
                message = `🚀 РЕЖИМ ТУРБО! Время истекает! Голосование завершится через 5 секунд!`;
                break;
        }"""
text = text.replace(old_switch, new_switch)

with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Added turbo mechanic")
