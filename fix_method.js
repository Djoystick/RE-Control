const fs = require('fs');
const file = 'H:/Work/RE_Control/src/main/game-bridge/VotingManager.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /handleDonation\(amount: number\) \{[\s\S]*?\}(?=\s*getState\(\))/;

const fixedMethod = handleDonation(amount: number) {
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
        sysLogger.info(\Donation received for amount \. Force executing effect: \\);
        this.emit('vip:effect', randomEffect.id);
    }
;

content = content.replace(regex, fixedMethod);
fs.writeFileSync(file, content);
console.log('Fixed');
