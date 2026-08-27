import { sysLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { ChatCommand } from '../chat-bridge/IChatBridge';
import { dbManager } from '../db/DatabaseManager';

export interface VoteOption {
    id: number;
    effectId: string;
    displayName: string;
    votes: number;
}

export interface VoteState {
    isActive: boolean;
    options: VoteOption[];
    timeRemainingMs: number;
    totalVotes: number;
    intervention?: { type: string; message: string } | null;
}

export class VotingManager extends EventEmitter {
    
    private interventionTimer: NodeJS.Timeout | null = null;
    private interventionState: any = null;
    private options: VoteOption[] = [];
    private isActive: boolean = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private cooldownTimer: NodeJS.Timeout | null = null;
    private timeRemainingMs: number = 0;
    
    private readonly VOTE_DURATION_MS = 60000; // 60 seconds to vote
    private COOLDOWN_DURATION_MS = 600000; // 10 minutes cooldown (Marathon pacing default)
    
    // The current pool of active effects
        private effectPool = [
        // Positive
        { id: 'light_heal', name: 'Подорожник (Лечение 15%)', category: 'positive' },
        { id: 'speed_up', name: 'Адреналин (Ускорение)', category: 'positive' },
        { id: 'care_package', name: 'С небес (Патроны)', category: 'positive' },
        { id: 'green_herb', name: 'Зеленушка (Трава)', category: 'positive' },
        
        // Negative
        { id: 'push_back', name: 'Ветерок (Отброс)', category: 'negative' },
        { id: 'papercut', name: 'Царапина (-5% ХП)', category: 'negative' },
        { id: 'slow_down', name: 'Тяжелые ботинки (Замедление)', category: 'negative' },
        { id: 'empty_mag', name: 'Осечка (Пустой магазин)', category: 'negative' },
        { id: 'disarm', name: 'Пацифист (Оружие заблокировано)', category: 'negative' },
        
        // Psychological / Troll
        { id: 'hop', name: 'Ик! (Подскок)', category: 'psychological' },
        { id: 'spin_180', name: 'Головокружение (180°)', category: 'psychological' },
        { id: 'auto_run', name: 'Леон — спринтер', category: 'psychological' },
        { id: 'fov_narrow', name: 'Клаустрофобия (FOV-)', category: 'psychological' },
        { id: 'fov_wide', name: 'Рыбий глаз (FOV+)', category: 'psychological' },
        { id: 'camera_shake', name: 'Паническая атака', category: 'psychological' },
        { id: 'ui_wipe', name: 'Где мои очки? (UI Off)', category: 'psychological' },
        { id: 'mirror_screen', name: 'Зеркало (Отзеркаливание)', category: 'psychological' },
        { id: 'static_burst', name: 'Помехи экрана (2с)', category: 'psychological' },
        { id: 'invert_controls', name: 'Пьяный геймпад (10с)', category: 'psychological' },
        { id: 'blackout', name: 'Вырубили свет (3с)', category: 'psychological' },
        { id: 'mute_sound', name: 'Немой режим (Без звука)', category: 'psychological' },
        { id: 'fake_mrx', name: 'Свой среди чужих (Шаги Тирана)', category: 'psychological' }
    ];

    private activeTrustedUsers = new Map<string, number>();
    private traitorState: { active: boolean, username: string | null, options: any[], timer: NodeJS.Timeout | null } = { active: false, username: null, options: [], timer: null };

    constructor() {
        super();
        setInterval(() => {
            const count = this.getTrustedCount();
            this.emit('trusted:count', count);
        }, 5000);
    }

    private getTrustedCount(): number {
        const now = Date.now();
        let count = 0;
        for (const [_, timestamp] of this.activeTrustedUsers.entries()) {
            if (now - timestamp < 15 * 60 * 1000) { // 15 mins active
                count++;
            }
        }
        return count;
    }

    startCycle() {
        if (this.isActive || this.traitorState.active) return;
        this.startVote();
    }

    private startVote() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        if (this.interventionTimer) { clearTimeout(this.interventionTimer); this.interventionTimer = null; }
        this.isActive = true;
        
        this.interventionState = null;
        this.timeRemainingMs = this.VOTE_DURATION_MS;
        
        // Pick 3 random options
        const posPool = this.effectPool.filter(e => e.category === 'positive');
        const negPool = this.effectPool.filter(e => e.category === 'negative');
        const psyPool = this.effectPool.filter(e => e.category === 'psychological');
        
        const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
        
        let selectedEffects = [
            getRandom(posPool),
            getRandom(negPool),
            getRandom(psyPool)
        ].filter(Boolean); // Fallback in case a category is empty

        // If for some reason we have less than 3, fill from remaining
        while(selectedEffects.length < 3) {
            const fallback = getRandom(this.effectPool);
            if (!selectedEffects.find(e => e.id === fallback.id)) {
                selectedEffects.push(fallback);
            }
        }
        
        // Shuffle the 3 options so they aren't always 1:Pos 2:Neg 3:Psy
        selectedEffects = selectedEffects.sort(() => 0.5 - Math.random());

        this.options = selectedEffects.map((effect, index) => ({
            id: index + 1,
            effectId: effect.id,
            displayName: effect.name,
            votes: 0
        }));

        sysLogger.info('Started new voting cycle. Options:', this.options.map(o => o.displayName));
        this.emit('vote:start', this.getState());

        
        // 30% chance for an intervention exactly halfway through
        this.interventionTimer = setTimeout(() => {
            this.rollIntervention();
        }, this.VOTE_DURATION_MS / 2);

        this.timer = setInterval(() => {
            this.timeRemainingMs -= 1000;
            if (this.timeRemainingMs <= 0) {
                this.endVote();
            } else {
                this.emit('vote:tick', this.getState());
            }
        }, 1000);
    }

    invokeTraitor(): boolean {
        const now = Date.now();
        const activeUsers = Array.from(this.activeTrustedUsers.entries())
            .filter(([_, timestamp]) => now - timestamp < 15 * 60 * 1000)
            .map(([username, _]) => username);

        if (activeUsers.length === 0) {
            return false;
        }

        const chosenUser = activeUsers[Math.floor(Math.random() * activeUsers.length)];

        this.stop(); // Stop autopilot

        const shuffled = [...this.effectPool].sort(() => 0.5 - Math.random());
        const options = shuffled.slice(0, 5).map((effect, index) => ({
            id: index + 1,
            effectId: effect.id,
            displayName: effect.name
        }));

        this.traitorState = {
            active: true,
            username: chosenUser,
            options,
            timer: setTimeout(() => {
                this.endTraitor(false);
            }, 3 * 60 * 1000)
        };

        this.emit('traitor:start', { username: chosenUser, options });
        sysLogger.info(`Traitor mode invoked. Chosen traitor: ${chosenUser}`);
        return true;
    }

    private endTraitor(completed: boolean) {
        if (this.traitorState.timer) {
            clearTimeout(this.traitorState.timer);
        }
        this.traitorState = { active: false, username: null, options: [], timer: null };
        this.emit('traitor:end', { completed });
        this.startCycle();
    }

    handleChatCommand(cmd: ChatCommand) {
        if (cmd.isTrusted) {
            this.activeTrustedUsers.set(cmd.username, Date.now());
        }

        if (this.traitorState.active) {
            if (cmd.username.toLowerCase() === this.traitorState.username?.toLowerCase()) {
                const voteText = cmd.command.trim();
                const voteId = parseInt(voteText, 10);
                
                if (!isNaN(voteId)) {
                    const option = this.traitorState.options.find(opt => opt.id === voteId);
                    if (option) {
                        this.emit('traitor:effect', option.effectId);
                        this.endTraitor(true);
                    }
                }
            }
            return; // Ignore other votes during traitor mode
        }

        if (!this.isActive) return;
        
        // Very simple vote parsing: if they just type "1", "2", or "3"
        const voteText = cmd.command.trim();
        const voteId = parseInt(voteText, 10);
        
        if (!isNaN(voteId)) {
            const option = this.options.find(opt => opt.id === voteId);
            if (option) {
                option.votes++;

                // Add karma
                dbManager.addVote(cmd.username, option.effectId);
                
                this.emit('vote:update', this.getState());
            }
        }
    }

    private endVote() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        if (this.interventionTimer) { clearTimeout(this.interventionTimer); this.interventionTimer = null; }
        this.isActive = false;

        // Determine winner
        let winner = this.options[0];
        for (const opt of this.options) {
            if (opt.votes > winner.votes) {
                winner = opt;
            }
        }

        sysLogger.info('Voting ended. Winner: ' + winner.displayName + ' with ' + winner.votes + ' votes.');
        
        if ((winner as any).isMega) {
            winner.effectId = 'MEGA_' + winner.effectId;
        }
        this.emit('vote:end', { winner, state: this.getState() });

        // Start cooldown, then start next cycle
        this.cooldownTimer = setTimeout(() => {
            this.startVote();
        }, this.COOLDOWN_DURATION_MS);
    }

        handleDonation(amount: number) {
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
getState(): VoteState {
        const totalVotes = this.options.reduce((sum, opt) => sum + opt.votes, 0);
        return {
            isActive: this.isActive,
            options: this.options,
            timeRemainingMs: this.timeRemainingMs,
            totalVotes,
            intervention: this.interventionState
        };
    }
    
    stop() {
        this.isActive = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        if (this.interventionTimer) { clearTimeout(this.interventionTimer); this.interventionTimer = null; }
        if (this.traitorState.active) {
            if (this.traitorState.timer) clearTimeout(this.traitorState.timer);
            this.traitorState = { active: false, username: null, options: [], timer: null };
            this.emit('traitor:end', { completed: false });
        }
    }

    setCooldown(ms: number) {
        this.COOLDOWN_DURATION_MS = ms;
    }

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
}


