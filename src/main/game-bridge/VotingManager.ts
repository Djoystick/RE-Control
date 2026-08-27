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
}

export class VotingManager extends EventEmitter {
    private options: VoteOption[] = [];
    private isActive: boolean = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private cooldownTimer: NodeJS.Timeout | null = null;
    private timeRemainingMs: number = 0;
    
    private readonly VOTE_DURATION_MS = 60000; // 60 seconds to vote
    private COOLDOWN_DURATION_MS = 600000; // 10 minutes cooldown (Marathon pacing default)
    
    // The current pool of active effects
    private effectPool = [
        { id: 'hop', name: 'Ик! (Подскок)' },
        { id: 'push_back', name: 'Ветерок (Отброс)' },
        { id: 'spin_180', name: 'Головокружение (180°)' },
        { id: 'auto_run', name: 'Леон — спринтер' },
        { id: 'fov_narrow', name: 'Клаустрофобия (FOV-)' },
        { id: 'fov_wide', name: 'Рыбий глаз (FOV+)' },
        { id: 'camera_shake', name: 'Паническая атака' },
        { id: 'ui_wipe', name: 'Где мои очки? (UI Off)' },
        { id: 'mirror_screen', name: 'Зеркало (Отзеркаливание)' },
        { id: 'static_burst', name: 'Помехи экрана (2с)' },
        { id: 'light_heal', name: 'Подорожник (Лечение 15%)' },
        { id: 'papercut', name: 'Царапина (-5% ХП)' },
        { id: 'speed_up', name: 'Адреналин (Ускорение)' },
        { id: 'slow_down', name: 'Тяжелые ботинки (Замедление)' },
        { id: 'empty_mag', name: 'Осечка (Пустой магазин)' },
        { id: 'care_package', name: 'С небес (Патроны)' },
        { id: 'green_herb', name: 'Зеленушка (Трава)' },
        { id: 'invert_controls', name: 'Пьяный геймпад (10с)' },
        { id: 'disarm', name: 'Пацифист (Оружие заблокировано)' },
        { id: 'blackout', name: 'Вырубили свет (3с)' },
        { id: 'mute_sound', name: 'Немой режим (Без звука)' },
        { id: 'fake_mrx', name: 'Свой среди чужих (Шаги Тирана)' }
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
        this.isActive = true;
        this.timeRemainingMs = this.VOTE_DURATION_MS;
        
        // Pick 3 random options
        const shuffled = [...this.effectPool].sort(() => 0.5 - Math.random());
        this.options = shuffled.slice(0, 3).map((effect, index) => ({
            id: index + 1,
            effectId: effect.id,
            displayName: effect.name,
            votes: 0
        }));

        sysLogger.info('Started new voting cycle. Options:', this.options.map(o => o.displayName));
        this.emit('vote:start', this.getState());

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
        this.isActive = false;

        // Determine winner
        let winner = this.options[0];
        for (const opt of this.options) {
            if (opt.votes > winner.votes) {
                winner = opt;
            }
        }

        sysLogger.info('Voting ended. Winner: ' + winner.displayName + ' with ' + winner.votes + ' votes.');
        this.emit('vote:end', { winner, state: this.getState() });

        // Start cooldown, then start next cycle
        this.cooldownTimer = setTimeout(() => {
            this.startVote();
        }, this.COOLDOWN_DURATION_MS);
    }

    handleDonation(amount: number) {
        // Pick a random effect since price configurator isn't available yet
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
            totalVotes
        };
    }
    
    stop() {
        this.isActive = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        if (this.traitorState.active) {
            if (this.traitorState.timer) clearTimeout(this.traitorState.timer);
            this.traitorState = { active: false, username: null, options: [], timer: null };
            this.emit('traitor:end', { completed: false });
        }
    }

    setCooldown(ms: number) {
        this.COOLDOWN_DURATION_MS = ms;
    }
}
