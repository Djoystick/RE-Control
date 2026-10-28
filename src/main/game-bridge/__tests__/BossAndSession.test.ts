import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VotingManager } from '../VotingManager';
import type { ChatCommand } from '../../chat-bridge/IChatBridge';

vi.mock('../../utils/logger', () => ({
    sysLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Session store is file-backed via electron app; stub it out
vi.mock('../SessionStore', () => ({
    sessionStore: { load: vi.fn(() => ({ roundNumber: 0, negativeWinStreak: 0, recentWinners: [], winRounds: {}, megaMoments: [] })), save: vi.fn(), clear: vi.fn() }
}));

vi.mock('../../db/DatabaseManager', () => ({
    dbManager: {
        addVote: vi.fn(),
        spendKarma: vi.fn(() => true),
        getViewerKarma: vi.fn(() => 0),
        getLeaderboardFull: vi.fn(() => []),
        getTopNegative: vi.fn(() => [])
    }
}));

// Deterministic randomness for boss-round rolls
vi.spyOn(Math, 'random').mockReturnValue(0.5);

function vote(vm: VotingManager, username: string, digit: string) {
    const cmd: ChatCommand = { username, command: digit, args: [], isTrusted: false };
    vm.handleChatCommand(cmd);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('VotingManager — boss rounds', () => {
    it('starts a boss round when chance is 1 and exposes the threshold', () => {
        const vm = new VotingManager();
        vm.setDirectorConfig({ bossRoundChance: 1, bossThreshold: 5 });
        vi.mocked(Math.random).mockReturnValue(0.99);

        vm.startCycle();
        const state = vm.getState();

        expect(state.roundType).toBe('boss');
        expect(state.boss?.threshold).toBe(5);
        expect(state.options).toHaveLength(3);
        // Boss triple contains no positive effect
        expect(state.options.every(o => o.category !== 'positive')).toBe(true);
        vm.stop();
    });

    it('never schedules two boss rounds back to back', () => {
        const vm = new VotingManager();
        vm.setDirectorConfig({ bossRoundChance: 1, bossThreshold: 1 });
        vi.mocked(Math.random).mockReturnValue(0.99);

        vm.startCycle();
        expect(vm.getState().roundType).toBe('boss');
        vote(vm, 'u1', '1');
        vi.advanceTimersByTime(61000);

        vm.startCycle();
        expect(vm.getState().roundType).toBe('normal');
        vm.stop();
    });

    it('fails the round when turnout is below the threshold', () => {
        const vm = new VotingManager();
        vm.setDirectorConfig({ bossRoundChance: 1, bossThreshold: 10 });
        vi.mocked(Math.random).mockReturnValue(0.99);

        const ends: any[] = [];
        vm.on('vote:end', (p: any) => ends.push(p));

        vm.startCycle();
        vote(vm, 'u1', '1');
        vote(vm, 'u2', '1');
        vi.advanceTimersByTime(61000);

        const last = ends[ends.length - 1];
        expect(last.winner).toBeNull();
        expect(last.bossFailed).toBe(true);
        vm.stop();
    });

    it('passes the round when turnout reaches the threshold', () => {
        const vm = new VotingManager();
        vm.setDirectorConfig({ bossRoundChance: 1, bossThreshold: 3 });
        vi.mocked(Math.random).mockReturnValue(0.99);

        const ends: any[] = [];
        vm.on('vote:end', (p: any) => ends.push(p));

        vm.startCycle();
        vote(vm, 'u1', '1');
        vote(vm, 'u2', '1');
        vote(vm, 'u3', '1');
        vi.advanceTimersByTime(61000);

        const last = ends[ends.length - 1];
        expect(last.winner).not.toBeNull();
        expect(last.bossFailed).toBeUndefined();
        vm.stop();
    });

    it('emits boss:result with turnout numbers', () => {
        const vm = new VotingManager();
        vm.setDirectorConfig({ bossRoundChance: 1, bossThreshold: 5 });
        vi.mocked(Math.random).mockReturnValue(0.99);

        const results: any[] = [];
        vm.on('boss:result', (p: any) => results.push(p));

        vm.startCycle();
        vote(vm, 'u1', '1');
        vote(vm, 'u2', '2');
        vi.advanceTimersByTime(61000);

        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(false);
        expect(results[0].votes).toBe(2);
        expect(results[0].threshold).toBe(5);
        vm.stop();
    });

    it('disables boss rounds when chance is 0', () => {
        const vm = new VotingManager();
        vm.setDirectorConfig({ bossRoundChance: 0 });
        vi.mocked(Math.random).mockReturnValue(0.5);

        vm.startCycle();
        expect(vm.getState().roundType).toBe('normal');
        expect(vm.getState().boss).toBeNull();
        vm.stop();
    });
});

describe('VotingManager — session persistence', () => {
    it('snapshots round number, streak and winners', () => {
        const vm = new VotingManager();
        vm.setDirectorConfig({ bossRoundChance: 0 });
        vi.mocked(Math.random).mockReturnValue(0.9);

        vm.startCycle();
        vote(vm, 'u1', '1');
        vi.advanceTimersByTime(61000);

        const snap = vm.getSessionSnapshot();
        expect(snap.roundNumber).toBe(1);
        expect(snap.recentWinners).toHaveLength(1);
        expect(Object.values(snap.winRounds).reduce((a, b) => a + b, 0)).toBe(1);
        vm.stop();
    });

    it('restores the snapshot into a fresh manager', () => {
        const vm = new VotingManager();
        vm.restoreSession({
            roundNumber: 7,
            negativeWinStreak: 2,
            recentWinners: ['blackout'],
            winRounds: { blackout: 3 },
            megaMoments: ['Подскок']
        });

        const snap = vm.getSessionSnapshot();
        expect(snap.roundNumber).toBe(7);
        expect(snap.negativeWinStreak).toBe(2);
        expect(snap.winRounds.blackout).toBe(3);
        expect(snap.megaMoments).toContain('Подскок');
    });

    it('resetSession clears all statistics', () => {
        const vm = new VotingManager();
        vm.restoreSession({
            roundNumber: 9,
            negativeWinStreak: 4,
            recentWinners: ['hop'],
            winRounds: { hop: 2 },
            megaMoments: ['Ик']
        });

        vm.resetSession();
        const snap = vm.getSessionSnapshot();
        expect(snap.roundNumber).toBe(0);
        expect(snap.negativeWinStreak).toBe(0);
        expect(snap.recentWinners).toHaveLength(0);
        // Cleared counters are omitted from the snapshot (only non-zero wins are stored)
        expect(snap.winRounds.hop ?? 0).toBe(0);
        expect(snap.megaMoments).toHaveLength(0);
    });
});