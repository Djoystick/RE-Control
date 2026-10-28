import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VotingManager } from '../VotingManager';
import type { ChatCommand } from '../../chat-bridge/IChatBridge';

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../../utils/logger', () => ({
    sysLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const karmaBalance = new Map<string, number>();
const voteCalls: { username: string; category: string }[] = [];

vi.mock('../../db/DatabaseManager', () => ({
    dbManager: {
        addVote: (username: string, _effectId: string, category: string) => {
            voteCalls.push({ username, category });
        },
        spendKarma: (username: string, amount: number) => {
            const bal = karmaBalance.get(username) ?? 0;
            if (bal < amount) return false;
            karmaBalance.set(username, bal - amount);
            return true;
        },
        getViewerKarma: (username: string) => karmaBalance.get(username) ?? 0,
        getLeaderboardFull: () => [
            { username: 'Viewer_1', karma: 12, negativeVotes: 1, roundsVoted: 10, karmaSpent: 0 },
            { username: 'Viewer_2', karma: 7, negativeVotes: 5, roundsVoted: 8, karmaSpent: 0 }
        ],
        getTopNegative: () => [
            { username: 'Viewer_2', karma: 7, negativeVotes: 5, roundsVoted: 8, karmaSpent: 0 }
        ]
    }
}));

// Deterministic randomness: always pick the first candidate
vi.spyOn(Math, 'random').mockReturnValue(0.1);

function makeManager() {
    const vm = new VotingManager();
    return vm;
}

function vote(vm: VotingManager, username: string, digit: string, isTrusted = false) {
    const cmd: ChatCommand = { username, command: digit, args: [], isTrusted };
    vm.handleChatCommand(cmd);
}

function chat(vm: VotingManager, username: string, command: string) {
    const cmd: ChatCommand = { username, command, args: [], isTrusted: false };
    vm.handleChatCommand(cmd);
}

beforeEach(() => {
    vi.useFakeTimers();
    karmaBalance.clear();
    voteCalls.length = 0;
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('VotingManager — vote integrity', () => {
    it('moves a vote instead of stacking it', () => {
        const vm = makeManager();
        vm.startCycle();
        const state1 = vm.getState();
        expect(state1.options).toHaveLength(3);

        vote(vm, 'alice', '1');
        let state = vm.getState();
        expect(state.options[0].votes).toBe(1);
        expect(state.totalVotes).toBe(1);

        // Same viewer votes for option 2 → option 1 drops to 0
        vote(vm, 'alice', '2');
        state = vm.getState();
        expect(state.options[0].votes).toBe(0);
        expect(state.options[1].votes).toBe(1);
        expect(state.totalVotes).toBe(1);
        vm.stop();
    });

    it('ignores a repeated vote for the same option', () => {
        const vm = makeManager();
        vm.startCycle();
        vote(vm, 'alice', '1');
        vote(vm, 'alice', '1');
        vote(vm, 'alice', '1');
        expect(vm.getState().options[0].votes).toBe(1);
        vm.stop();
    });

    it('counts karma once per round, not per message', () => {
        const vm = makeManager();
        vm.startCycle();
        vote(vm, 'alice', '1');
        vote(vm, 'alice', '2');
        vote(vm, 'alice', '3');
        expect(voteCalls.filter(c => c.username === 'alice')).toHaveLength(1);
        vm.stop();
    });

    it('rejects malformed digits', () => {
        const vm = makeManager();
        vm.startCycle();
        vote(vm, 'alice', '10');
        vote(vm, 'alice', '0');
        vote(vm, 'alice', '2.5');
        vote(vm, 'alice', 'три');
        expect(vm.getState().totalVotes).toBe(0);
        vm.stop();
    });

    it('awards MEGA only after 5 distinct consecutive voters', () => {
        const vm = makeManager();
        vm.startCycle();
        for (const user of ['u1', 'u2', 'u3', 'u4']) vote(vm, user, '1');
        expect(vm.getState().options[0].isMega).toBeFalsy();
        vote(vm, 'u5', '1');
        expect(vm.getState().options[0].isMega).toBe(true);
        vm.stop();
    });

    it('breaks the MEGA streak when someone votes for another option', () => {
        const vm = makeManager();
        vm.startCycle();
        vote(vm, 'u1', '1');
        vote(vm, 'u2', '1');
        vote(vm, 'u3', '2');
        vote(vm, 'u4', '1');
        vote(vm, 'u5', '1');
        expect(vm.getState().options[0].isMega).toBeFalsy();
        vm.stop();
    });
});

describe('VotingManager — karma abilities', () => {
    it('!shield without enough karma is rejected with a hint', () => {
        const vm = makeManager();
        const replies: string[] = [];
        vm.on('bot:reply', (r: string) => replies.push(r));
        karmaBalance.set('alice', 5);

        chat(vm, 'alice', '!shield');

        expect(replies.some(r => r.includes('нужно 20 кармы'))).toBe(true);
        expect(karmaBalance.get('alice')).toBe(5);
    });

    it('!shield spends karma and cancels the next hostile winner', () => {
        const vm = makeManager();
        const replies: string[] = [];
        vm.on('bot:reply', (r: string) => replies.push(r));
        karmaBalance.set('alice', 25);

        chat(vm, 'alice', '!shield');
        expect(karmaBalance.get('alice')).toBe(5);
        expect(replies.some(r => r.includes('ЗАЩИТНЫЙ ПРОТОКОЛ'))).toBe(true);

        // Only one shield per stream
        karmaBalance.set('alice', 100);
        chat(vm, 'alice', '!shield');
        expect(replies.some(r => r.includes('уже куплена'))).toBe(true);
        expect(karmaBalance.get('alice')).toBe(100);
    });

    it('shield consumes on a hostile winner and skips the effect', () => {
        const vm = makeManager();
        // High random: no random intervention at half-time, so the negative option can win
        (Math.random as unknown as { mockReturnValue: (v: number) => void }).mockReturnValue(0.9);
        karmaBalance.set('alice', 25);
        chat(vm, 'alice', '!shield');

        const ends: any[] = [];
        vm.on('vote:end', (payload: any) => ends.push(payload));

        vm.startCycle();
        // Options[1] is the negative slot; vote it up
        const state = vm.getState();
        const negativeOption = state.options.find(o => o.category === 'negative');
        expect(negativeOption).toBeDefined();
        for (const user of ['u1', 'u2', 'u3']) vote(vm, user, String(negativeOption!.id));

        // Fast-forward the vote timer to completion
        vi.advanceTimersByTime(61000);

        expect(ends.length).toBeGreaterThan(0);
        const last = ends[ends.length - 1];
        expect(last.winner).toBeNull();
        expect(last.shieldedBy).toBe('alice');
        vm.stop();
    });

    it('!reroll requires an active round, spends karma and changes the triple', () => {
        const vm = makeManager();
        const replies: string[] = [];
        vm.on('bot:reply', (r: string) => replies.push(r));
        karmaBalance.set('alice', 30);

        chat(vm, 'alice', '!reroll');
        expect(replies.some(r => r.includes('только во время голосования'))).toBe(true);
        expect(karmaBalance.get('alice')).toBe(30);

        vm.startCycle();
        chat(vm, 'alice', '!reroll');
        expect(karmaBalance.get('alice')).toBe(20);
        expect(replies.some(r => r.includes('ПЕРЕБРОСКУ'))).toBe(true);

        // Second reroll in the same round is denied
        chat(vm, 'alice', '!reroll');
        expect(replies.some(r => r.includes('уже использована'))).toBe(true);
        expect(karmaBalance.get('alice')).toBe(20);
        vm.stop();
    });

    it('!report builds a summary from the database', () => {
        const vm = makeManager();
        const replies: string[] = [];
        vm.on('bot:reply', (r: string) => replies.push(r));

        chat(vm, 'alice', '!report');

        const report = replies[0];
        expect(report).toContain('ИТОГИ СТРИМА');
        expect(report).toContain('Viewer_1');
        expect(report).toContain('Viewer_2');
        expect(report).toContain('раундов');
    });
});

describe('VotingManager — director', () => {
    it('mercy buffer activates after the configured negative streak', () => {
        const vm = makeManager();
        vm.setDirectorConfig({ mercyStreak: 1 });
        // Avoid a random intervention at half-time so the negative option can win
        (Math.random as unknown as { mockReturnValue: (v: number) => void }).mockReturnValue(0.9);

        const ends: any[] = [];
        vm.on('vote:end', (p: any) => ends.push(p));

        // Force a negative winner twice
        for (let round = 0; round < 2; round++) {
            vm.startCycle();
            const negative = vm.getState().options.find(o => o.category === 'negative')!;
            vote(vm, `u${round}`, String(negative.id));
            vi.advanceTimersByTime(61000);
        }

        const stats = vm.getDirectorStats();
        expect(stats.negativeWinStreak).toBeGreaterThanOrEqual(1);
        vm.stop();
    });

    it('excludes recent winners from the next triple', () => {
        const vm = makeManager();
        vm.setDirectorConfig({ winnerCooldownRounds: 2 });

        const ends: any[] = [];
        vm.on('vote:end', (p: any) => ends.push(p));

        vm.startCycle();
        vote(vm, 'u1', '1');
        vi.advanceTimersByTime(61000);

        expect(ends[0]?.winner).toBeTruthy();
        const winnerId = ends[0].winner.effectId;

        vm.startCycle();
        const secondTriple = vm.getState().options.map(o => o.effectId);
        expect(secondTriple).not.toContain(winnerId);
        vm.stop();
    });
});