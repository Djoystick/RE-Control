import { sysLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { ChatCommand } from '../chat-bridge/IChatBridge';
import { dbManager } from '../db/DatabaseManager';
import { VOTABLE_EFFECTS, type EffectDef } from '../../shared/effects-registry';
import { sessionStore, type DirectorSession } from './SessionStore';

export interface VoteOption {
    id: number;
    effectId: string;
    displayName: string;
    votes: number;
    category?: string;
    isMega?: boolean;
}

export type RoundType = 'normal' | 'boss';

export interface BossRoundInfo {
    /** Голосов нужно набрать, чтобы эффект вообще сработал */
    threshold: number;
    /** Набрано голосов на момент завершения */
    votes: number;
    /** Прошёл ли порог */
    passed: boolean;
}

export interface VoteState {
    isActive: boolean;
    options: VoteOption[];
    timeRemainingMs: number;
    totalVotes: number;
    intervention?: { type: string; message: string } | null;
    roundType?: RoundType;
    boss?: BossRoundInfo | null;
    director?: {
        mercyActive: boolean;
        pityBoostedIds: string[];
    };
}

export interface DirectorConfig {
    enabled: boolean;
    /** Below this share of unique chatters voting at half-time the crowd is "quiet" */
    lowEngagementThreshold: number;
    /** Intervention chance when the crowd is quiet (0..1) */
    quietInterventionChance: number;
    /** Consecutive negative wins before the mercy buffer kicks in */
    mercyStreak: number;
    /** Rounds a recently-won effect is excluded from the voting pool */
    winnerCooldownRounds: number;
    /** Below this many win-rounds an effect is "unseen" and gets a showcase boost */
    unseenThreshold: number;
    /** Chance that a round becomes a boss round (0..1); 0 disables */
    bossRoundChance: number;
    /** Minimum distinct votes the chat must gather to beat a boss round */
    bossThreshold: number;
}

const DEFAULT_DIRECTOR: DirectorConfig = {
    enabled: true,
    lowEngagementThreshold: 0.25,
    quietInterventionChance: 0.6,
    mercyStreak: 3,
    winnerCooldownRounds: 2,
    unseenThreshold: 2,
    bossRoundChance: 0.1,
    bossThreshold: 12
};

type PoolEffect = { id: string; name: string; category: string; winRounds?: number };

export class VotingManager extends EventEmitter {

    private interventionTimer: NodeJS.Timeout | null = null;
    private interventionState: any = null;
    private options: VoteOption[] = [];
    private isActive: boolean = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private cooldownTimer: NodeJS.Timeout | null = null;
    private donationRestartTimer: NodeJS.Timeout | null = null;
    private timeRemainingMs: number = 0;
    private lastVotedOptionId: number | null = null;
    private consecutiveVotesCount: number = 0;

    private readonly VOTE_DURATION_MS = 60000; // 60 seconds to vote
    private COOLDOWN_DURATION_MS = 600000; // 10 minutes cooldown (Marathon pacing default)

    // --- Director state ---
    private director: DirectorConfig = { ...DEFAULT_DIRECTOR };
    private negativeWinStreak = 0;
    private roundNumber = 0;
    private recentWinners: string[] = [];
    /** Unique chatters seen during the current vote (participation pulse) */
    private roundChatters = new Set<string>();
    private chatCommandHandler: ((command: string, username: string) => void) | null = null;

    // --- Boss round state (v1.5.0) ---
    private currentRoundType: RoundType = 'normal';
    private bossRoundInfo: BossRoundInfo | null = null;

    // The current pool of active verified effects — sourced from the shared registry
    private effectPool: PoolEffect[] = VOTABLE_EFFECTS.map((e: EffectDef) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        winRounds: 0
    }));

    private activeTrustedUsers = new Map<string, number>();
    // One viewer = one vote; a new digit from the same viewer moves their vote
    private voterChoices = new Map<string, number>();
    private traitorState: { active: boolean, username: string | null, options: any[], timer: NodeJS.Timeout | null } = { active: false, username: null, options: [], timer: null };

    // --- Karma economy (v1.4.0) ---
    /** Viewers who bought a shield; each entry cancels one upcoming hostile winner */
    private pendingShields: string[] = [];
    /** Viewers who already bought a shield this stream (one purchase per stream) */
    private shieldBuyers = new Set<string>();
    /** Reroll is limited to one use per voting round (any viewer may fund it) */
    private rerollUsedThisRound = false;
    /** Names of effects that reached MEGA status this stream (for the report) */
    private megaMoments: string[] = [];

    static readonly SHIELD_COST = 20;
    static readonly REROLL_COST = 10;

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

    // ─── DIRECTOR: adaptive pacing ───────────────────────────────────────

    setDirectorConfig(config: Partial<DirectorConfig>) {
        this.director = { ...this.director, ...config };
        sysLogger.info('[Director] Config updated:', this.director);
    }

    getDirectorConfig(): DirectorConfig {
        return { ...this.director };
    }

    getDirectorStats(): { roundNumber: number; negativeWinStreak: number; recentWinners: string[] } {
        return {
            roundNumber: this.roundNumber,
            negativeWinStreak: this.negativeWinStreak,
            recentWinners: [...this.recentWinners]
        };
    }

    /** Effect ids the director currently excludes (recent winners) */
    private getExcludedIds(): Set<string> {
        if (!this.director.enabled || this.director.winnerCooldownRounds <= 0) return new Set();
        const excluded = new Set<string>();
        // recentWinners is ordered oldest→newest; only the last N entries cool down
        for (let i = Math.max(0, this.recentWinners.length - this.director.winnerCooldownRounds); i < this.recentWinners.length; i++) {
            excluded.add(this.recentWinners[i]);
        }
        return excluded;
    }

    private isMercyActive(): boolean {
        return this.director.enabled && this.negativeWinStreak >= this.director.mercyStreak;
    }

    /** Effects that rarely win get a temporary showcase boost in the next triple */
    private getPityBoostedIds(): string[] {
        if (!this.director.enabled) return [];
        const unseen = this.effectPool
            .filter(e => (e.winRounds ?? 0) < this.director.unseenThreshold)
            .map(e => e.id);
        return unseen.slice(0, 3);
    }

    /** Engagement pulse measured at half-time: unique voters / unique chatters */
    private isCrowdQuiet(): boolean {
        const chatters = Math.max(this.roundChatters.size, 1);
        const voters = this.voterChoices.size;
        return voters / chatters < this.director.lowEngagementThreshold;
    }

    private rollDirectorIntervention(): void {
        if (!this.isActive) return;
        const quiet = this.isCrowdQuiet();
        const chance = quiet ? this.director.quietInterventionChance : 0.3;
        if (quiet) {
            sysLogger.info(`[Director] Crowd pulse: ${this.voterChoices.size}/${this.roundChatters.size} chatters voting — quiet crowd, boosting intervention chance to ${Math.round(chance * 100)}%.`);
            this.emit('director:pulse', { voters: this.voterChoices.size, chatters: this.roundChatters.size });
        } else {
            sysLogger.info(`[Director] Crowd pulse: ${this.voterChoices.size}/${this.roundChatters.size} chatters voting — engagement healthy, fair dice.`);
        }
        this.rollIntervention(false, chance);
    }

    // ─── Chat commands (!karma, !top, !effects, !me) ─────────────────────

    /**
     * The host (index.ts) routes non-numeric chat messages here via
     * TwitchBridge / ChatSimulator; replies are emitted as 'bot:reply'.
     */
    setChatCommandHandler(handler: (command: string, username: string) => void) {
        this.chatCommandHandler = handler;
    }

    private handleChatCommandText(cmd: ChatCommand): boolean {
        const text = cmd.command.trim().toLowerCase();
        if (!text.startsWith('!')) return false;

        // Karma abilities are stateful, so they are handled here rather than in the host
        switch (text) {
            case '!shield':
                this.buyShield(cmd.username);
                return true;
            case '!reroll':
                this.buyReroll(cmd.username);
                return true;
            case '!report':
                this.emit('bot:reply', this.buildSessionReport());
                return true;
        }

        if (this.chatCommandHandler) {
            this.chatCommandHandler(text, cmd.username);
        }
        return true;
    }

    // ─── KARMA ECONOMY ───────────────────────────────────────────────────

    private buyShield(username: string) {
        if (this.shieldBuyers.has(username)) {
            this.emit('bot:reply', `☣️ [UMBRELLA CORP] @${username}, защита уже куплена в этом стриме. Одна на стрим.`);
            return;
        }
        if (!dbManager.spendKarma(username, VotingManager.SHIELD_COST)) {
            this.emit('bot:reply', `☣️ [UMBRELLA CORP] @${username}, нужно ${VotingManager.SHIELD_COST} кармы для защиты. Голосуй за помощь, чтобы накопить.`);
            return;
        }
        this.shieldBuyers.add(username);
        this.pendingShields.push(username);
        this.emit('bot:reply', `☣️ [UMBRELLA CORP] @${username} активировал ЗАЩИТНЫЙ ПРОТОКОЛ. Следующий враждебный эффект будет нейтрализован.`);
        sysLogger.info(`[Karma] ${username} bought a shield (${VotingManager.SHIELD_COST} karma). Pending shields: ${this.pendingShields.length}`);
    }

    private buyReroll(username: string) {
        if (!this.isActive) {
            this.emit('bot:reply', `☣️ [UMBRELLA CORP] @${username}, переброска доступна только во время голосования.`);
            return;
        }
        if (this.rerollUsedThisRound) {
            this.emit('bot:reply', `☣️ [UMBRELLA CORP] @${username}, переброска уже использована в этом раунде.`);
            return;
        }
        if (!dbManager.spendKarma(username, VotingManager.REROLL_COST)) {
            this.emit('bot:reply', `☣️ [UMBRELLA CORP] @${username}, нужно ${VotingManager.REROLL_COST} кармы для переброски.`);
            return;
        }
        this.rerollUsedThisRound = true;
        const oldOptions = this.options.map(o => o.displayName);
        this.buildVotingTriple();
        this.emit('bot:reply', `☣️ [UMBRELLA CORP] @${username} оплатил ПЕРЕБРОСКУ протокола. Новые варианты: ${this.options.map(o => `[${o.id}] ${o.displayName}`).join(' | ')}`);
        sysLogger.info(`[Karma] ${username} rerolled the round. Old: ${oldOptions.join(', ')}`);
        this.emit('vote:update', this.getState());
    }

    buildSessionReport(): string {
        const top = dbManager.getLeaderboardFull(5);
        const hostile = dbManager.getTopNegative(1)[0];
        if (top.length === 0) {
            return '☣️ [UMBRELLA CORP] Отчёт пуст — в этом стриме ещё никто не голосовал.';
        }
        const topLine = top.map((v, i) => `${i + 1}) ${v.username} ${v.karma > 0 ? '+' : ''}${v.karma}`).join(' ');
        const mega = this.megaMoments.length ? `MEGA: ${this.megaMoments.join(', ')}.` : 'MEGA не активировался.';
        const hostileLine = hostile ? `Самый кровожадный: ${hostile.username} (${hostile.negativeVotes} враждебных голосов).` : '';
        return `☣️ [UMBRELLA CORP] ИТОГИ СТРИМА: раундов — ${this.roundNumber}. Топ: ${topLine}. ${hostileLine} ${mega}`;
    }

    /** Snapshot for the overlay/UI report widget */
    getSessionReport() {
        return {
            rounds: this.roundNumber,
            leaderboard: dbManager.getLeaderboardFull(5),
            hostile: dbManager.getTopNegative(1)[0] ?? null,
            megaMoments: [...this.megaMoments],
            text: this.buildSessionReport()
        };
    }

    private consumeShieldIfAny(): string | null {
        return this.pendingShields.shift() ?? null;
    }

    // ─── SESSION PERSISTENCE (v1.5.0) ────────────────────────────────────

    /** Слепок состояния Директора для выживания рестарта приложения */
    getSessionSnapshot(): DirectorSession {
        const winRounds: Record<string, number> = {};
        for (const effect of this.effectPool) {
            if (effect.winRounds) winRounds[effect.id] = effect.winRounds;
        }
        return {
            roundNumber: this.roundNumber,
            negativeWinStreak: this.negativeWinStreak,
            recentWinners: [...this.recentWinners],
            winRounds,
            megaMoments: [...this.megaMoments]
        };
    }

    /** Восстанавливает состояние Директора после рестарта */
    restoreSession(snapshot: DirectorSession) {
        this.roundNumber = snapshot.roundNumber;
        this.negativeWinStreak = snapshot.negativeWinStreak;
        this.recentWinners = [...snapshot.recentWinners];
        this.megaMoments = [...snapshot.megaMoments];
        for (const effect of this.effectPool) {
            effect.winRounds = snapshot.winRounds[effect.id] ?? 0;
        }
        sysLogger.info(`[Session] Restored: round ${this.roundNumber}, negative streak ${this.negativeWinStreak}, recent winners ${this.recentWinners.length}`);
    }

    /** Пишет слепок на диск (вызывается при stop/panicStop/выходе) */
    persistSession() {
        sessionStore.save(this.getSessionSnapshot());
    }

    /** Полный сброс статистики сессии (кнопка «новый стрим») */
    resetSession() {
        this.roundNumber = 0;
        this.negativeWinStreak = 0;
        this.recentWinners = [];
        this.megaMoments = [];
        for (const effect of this.effectPool) effect.winRounds = 0;
        sessionStore.clear();
        sysLogger.info('[Session] New stream — director statistics reset');
    }

    // ─── BOSS ROUNDS (v1.5.0) ────────────────────────────────────────────

    /** Пул испытаний для босс-раунда: три самых жёстких эффекта */
    private pickBossOptions(): PoolEffect[] {
        const hostile = this.effectPool.filter(e => e.category !== 'positive');
        const shuffled = [...hostile].sort(() => 0.5 - Math.random());
        // Guarantee one negative and one psychological when possible
        const negative = shuffled.find(e => e.category === 'negative');
        const psychological = shuffled.find(e => e.category === 'psychological');
        const picked = [negative, psychological].filter(Boolean) as PoolEffect[];
        for (const candidate of shuffled) {
            if (picked.length >= 3) break;
            if (!picked.find(p => p.id === candidate.id)) picked.push(candidate);
        }
        return picked.slice(0, 3);
    }

    private shouldStartBossRound(): boolean {
        if (!this.director.enabled) return false;
        if (this.director.bossRoundChance <= 0) return false;
        // Never two boss rounds back to back
        if (this.currentRoundType === 'boss') return false;
        return Math.random() < this.director.bossRoundChance;
    }

    startCycle() {
        if (this.isActive || this.traitorState.active) return;
        this.startVote();
    }

    /** Picks the voting triple: director-aware selection, one effect per category */
    private buildVotingTriple() {
        const excluded = this.getExcludedIds();
        const mercy = this.isMercyActive();
        if (mercy) {
            sysLogger.info(`[Director] Mercy buffer ACTIVE: ${this.negativeWinStreak} negative wins in a row — boosting positive odds this round.`);
        }

        const pickOne = (category: string): PoolEffect | undefined => {
            let pool = this.effectPool.filter(e => e.category === category && !excluded.has(e.id));
            if (pool.length === 0) pool = this.effectPool.filter(e => e.category === category);
            if (pool.length === 0) return undefined;

            const pityBoosted = new Set(this.getPityBoostedIds());
            const weights = pool.map(e => pityBoosted.has(e.id) ? 3 : 1);
            const total = weights.reduce((a, b) => a + b, 0);
            let roll = Math.random() * total;
            for (let i = 0; i < pool.length; i++) {
                roll -= weights[i];
                if (roll <= 0) return pool[i];
            }
            return pool[pool.length - 1];
        };

        let selectedEffects: PoolEffect[] = [];

        if (mercy && Math.random() < 0.6) {
            // Mercy round: two positive slots instead of one
            selectedEffects = [
                pickOne('positive'),
                pickOne('positive'),
                pickOne('psychological')
            ].filter(Boolean) as PoolEffect[];
            sysLogger.info('[Director] Mercy round: extra positive effect injected into the triple.');
            this.emit('director:mercy', { negativeWinStreak: this.negativeWinStreak });
        } else {
            selectedEffects = [
                pickOne('positive'),
                pickOne('negative'),
                pickOne('psychological')
            ].filter(Boolean) as PoolEffect[];
        }

        // If for some reason we have less than 3, fill from remaining
        while (selectedEffects.length < 3) {
            const fallback = this.effectPool[Math.floor(Math.random() * this.effectPool.length)];
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
            votes: 0,
            category: effect.category
        }));
    }

    private startVote() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        if (this.interventionTimer) { clearTimeout(this.interventionTimer); this.interventionTimer = null; }
        this.isActive = true;
        this.roundNumber++;

        this.interventionState = null;
        this.timeRemainingMs = this.VOTE_DURATION_MS;
        this.lastVotedOptionId = null;
        this.consecutiveVotesCount = 0;
        this.voterChoices.clear();
        this.roundChatters.clear();
        this.rerollUsedThisRound = false;

        if (this.shouldStartBossRound()) {
            this.currentRoundType = 'boss';
            this.bossRoundInfo = { threshold: this.director.bossThreshold, votes: 0, passed: false };
            const bossEffects = this.pickBossOptions().sort(() => 0.5 - Math.random());
            this.options = bossEffects.map((effect, index) => ({
                id: index + 1,
                effectId: effect.id,
                displayName: effect.name,
                votes: 0,
                category: effect.category
            }));
            sysLogger.info(`[Boss] Round #${this.roundNumber} is a BOSS ROUND — threshold ${this.director.bossThreshold} votes.`, this.options.map(o => o.displayName));
        } else {
            this.currentRoundType = 'normal';
            this.bossRoundInfo = null;
            this.buildVotingTriple();
        }

        sysLogger.info(`Round #${this.roundNumber} started. Options:`, this.options.map(o => o.displayName));

        this.emit('vote:start', this.getState());

        // Intervention roll at half-time; the director may raise the stakes on a quiet crowd
        this.interventionTimer = setTimeout(() => {
            this.rollDirectorIntervention();
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
        this.roundChatters.add(cmd.username);

        if (this.traitorState.active) {
            if (cmd.username.toLowerCase() === this.traitorState.username?.toLowerCase()) {
                const voteText = cmd.command.trim();
                if (/^[1-5]$/.test(voteText)) {
                    const voteId = parseInt(voteText, 10);
                    const option = this.traitorState.options.find(opt => opt.id === voteId);
                    if (option) {
                        this.emit('traitor:effect', option.effectId);
                        this.endTraitor(true);
                    }
                }
            }
            return; // Ignore other votes during traitor mode
        }

        // Bot commands (!karma, !top, ...) are handled outside the vote flow
        if (this.handleChatCommandText(cmd)) return;

        if (!this.isActive) return;

        // Strict vote parsing: only "1", "2", or "3"
        const voteText = cmd.command.trim();
        if (/^[1-3]$/.test(voteText)) {
            const voteId = parseInt(voteText, 10);
            const option = this.options.find(opt => opt.id === voteId);
            if (option) {
                // Move the viewer's existing vote instead of stacking a new one
                const previousChoice = this.voterChoices.get(cmd.username);
                if (previousChoice === option.id) return;
                if (previousChoice !== undefined) {
                    const previousOption = this.options.find(opt => opt.id === previousChoice);
                    if (previousOption && previousOption.votes > 0) previousOption.votes--;
                }
                this.voterChoices.set(cmd.username, option.id);
                option.votes++;

                // Track MEGA combo (5 in a row for the same option)
                if (this.lastVotedOptionId === option.id) {
                    this.consecutiveVotesCount++;
                    if (this.consecutiveVotesCount >= 5 && !option.isMega) {
                        option.isMega = true;
                        sysLogger.info(`🔥 MEGA STATUS UNLOCKED for [${option.displayName}] (5 consecutive votes)!`);
                        this.emit('mega:unlock', { optionId: option.id, displayName: option.displayName });
                    }
                } else {
                    this.lastVotedOptionId = option.id;
                    this.consecutiveVotesCount = 1;
                }

                // Add karma based on effect category (first vote of the round only)
                if (previousChoice === undefined) {
                    const effectDef = this.effectPool.find(e => e.id === option.effectId);
                    const category = effectDef?.category || option.category || 'positive';
                    dbManager.addVote(cmd.username, option.effectId, category);
                }

                this.emit('vote:update', this.getState());
            }
        }
    }

    private endVote() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        if (this.interventionTimer) { clearTimeout(this.interventionTimer); this.interventionTimer = null; }
        this.isActive = false;

        // Determine winner with fair tie-breaking
        let maxVotes = -1;
        for (const opt of this.options) {
            if (opt.votes > maxVotes) {
                maxVotes = opt.votes;
            }
        }
        const topOptions = this.options.filter(opt => opt.votes === maxVotes);
        const winner = topOptions[Math.floor(Math.random() * topOptions.length)] || this.options[0];

        sysLogger.info('Voting ended. Winner: ' + winner.displayName + ' with ' + winner.votes + ' votes.');

        // Director bookkeeping: mercy streak and winner cooldown
        const effectDef = this.effectPool.find(e => e.id === winner.effectId);
        const winnerCategory = effectDef?.category || winner.category || 'positive';
        if (winnerCategory === 'negative') {
            this.negativeWinStreak++;
        } else {
            this.negativeWinStreak = 0;
        }
        if (effectDef) effectDef.winRounds = (effectDef.winRounds ?? 0) + 1;
        this.recentWinners.push(winner.effectId);
        if (this.recentWinners.length > 8) this.recentWinners.shift();

        if (winner.isMega) {
            winner.effectId = 'MEGA_' + winner.effectId;
            this.megaMoments.push(winner.displayName);
        }

        // Boss round: the effect lands only if the chat gathered enough distinct votes
        let bossFailed = false;
        if (this.currentRoundType === 'boss' && this.bossRoundInfo) {
            const distinctVotes = this.voterChoices.size;
            this.bossRoundInfo.votes = distinctVotes;
            this.bossRoundInfo.passed = distinctVotes >= this.bossRoundInfo.threshold;
            bossFailed = !this.bossRoundInfo.passed;
            sysLogger.info(`[Boss] Round #${this.roundNumber} ${bossFailed ? 'FAILED' : 'BEATEN'}: ${distinctVotes}/${this.bossRoundInfo.threshold} distinct votes.`);
            this.emit('boss:result', {
                passed: this.bossRoundInfo.passed,
                votes: distinctVotes,
                threshold: this.bossRoundInfo.threshold,
                winner: winner.displayName
            });
        }

        // Karma economy: a purchased shield cancels the incoming hostile effect once
        // (skipped when the boss round already swallowed the effect)
        let shieldedBy: string | null = null;
        if (!bossFailed && winnerCategory !== 'positive') {
            shieldedBy = this.consumeShieldIfAny();
        }

        if (shieldedBy) {
            sysLogger.info(`[Karma] Shield from ${shieldedBy} cancelled hostile winner [${winner.displayName}].`);
            this.emit('vote:shielded', { by: shieldedBy, cancelled: winner.displayName });
            this.emit('vote:end', { winner: null, shieldedBy, cancelled: winner.displayName, state: this.getState() });
        } else if (bossFailed) {
            this.emit('vote:end', { winner: null, bossFailed: true, cancelled: winner.displayName, state: this.getState() });
        } else {
            this.emit('vote:end', { winner, state: this.getState() });
        }

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
            if (this.donationRestartTimer) clearTimeout(this.donationRestartTimer);
            this.donationRestartTimer = setTimeout(() => {
                this.donationRestartTimer = null;
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
        const mercyActive = this.isMercyActive();
        return {
            isActive: this.isActive,
            options: this.options,
            timeRemainingMs: this.timeRemainingMs,
            totalVotes,
            intervention: this.interventionState,
            roundType: this.currentRoundType,
            boss: this.bossRoundInfo,
            director: {
                mercyActive,
                pityBoostedIds: mercyActive ? this.getPityBoostedIds() : []
            }
        };
    }

    stop() {
        this.isActive = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        if (this.interventionTimer) { clearTimeout(this.interventionTimer); this.interventionTimer = null; }
        if (this.donationRestartTimer) { clearTimeout(this.donationRestartTimer); this.donationRestartTimer = null; }
        if (this.traitorState.active) {
            if (this.traitorState.timer) clearTimeout(this.traitorState.timer);
            this.traitorState = { active: false, username: null, options: [], timer: null };
            this.emit('traitor:end', { completed: false });
        }
        this.persistSession();
    }

    /** Hard stop for the panic hotkey: freeze everything, no auto-restart */
    panicStop() {
        this.stop();
        if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
        this.persistSession();
        this.emit('vote:update', this.getState());
        sysLogger.warn('[VotingManager] PANIC STOP — autopilot frozen until manually resumed.');
    }

    setCooldown(ms: number) {
        this.COOLDOWN_DURATION_MS = ms;
    }

    public rollIntervention(force: boolean = false, chance: number = 0.3) {
        if (!this.isActive) return;

        if (!force && Math.random() > chance) {
            sysLogger.info('Intervention rolled: No intervention this time.');
            return;
        }

        const interventions = ['veto', 'invert', 'blind', 'equalize', 'turbo'];
        const chosen = interventions[Math.floor(Math.random() * interventions.length)];

        sysLogger.info(`Intervention rolled: ${chosen}!`);

        let message = '';

        switch (chosen) {
            case 'veto': {
                if (this.options.length > 1) {
                    let leaderIdx = 0;
                    for (let i = 1; i < this.options.length; i++) {
                        if (this.options[i].votes > this.options[leaderIdx].votes) {
                            leaderIdx = i;
                        }
                    }
                    const removed = this.options.splice(leaderIdx, 1)[0];
                    // Renumber remaining options cleanly
                    this.options.forEach((opt, idx) => {
                        opt.id = idx + 1;
                    });
                    message = `🛑 ВЕТО АМБРЕЛЛЫ! Лидирующая опция [${removed?.displayName}] удалена! Голосуйте за оставшиеся!`;
                }
                break;
            }
            case 'invert': {
                if (this.options.length >= 2) {
                    let maxOpt = this.options[0];
                    let minOpt = this.options[0];
                    for (const opt of this.options) {
                        if (opt.votes > maxOpt.votes) maxOpt = opt;
                        if (opt.votes < minOpt.votes) minOpt = opt;
                    }
                    if (maxOpt !== minOpt) {
                        const temp = maxOpt.votes;
                        maxOpt.votes = minOpt.votes;
                        minOpt.votes = temp;
                    }
                }
                message = `🔄 ИНВЕРСИЯ! Голоса лидера и аутсайдера поменялись местами!`;
                break;
            }
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
