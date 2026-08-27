import re
with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "r", encoding="utf-8") as f:
    text = f.read()

fixed = """handleDonation(amount: number) {
        if (amount === 300) {
            sysLogger.info('Donation received for amount 300. Triggering OUT-OF-TURN VOTE!');
            this.emit('vote:interrupted');
            this.stop();
            setTimeout(() => {
                this.startCycle();
            }, 1000);
            return;
        }

        const randomEffect = this.effectPool[Math.floor(Math.random() * this.effectPool.length)];
        sysLogger.info(`Donation received for amount ${amount}. Force executing effect: ${randomEffect.name}`);
        this.emit('vip:effect', randomEffect.id);
    }
"""

text = re.sub(r'handleDonation\(amount: number\) \{[\s\S]*?\}\s*(?=getState\(\))', fixed, text)

with open(r"H:\Work\RE_Control\src\main\game-bridge\VotingManager.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("Done Python")
