import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManager } from '../DatabaseManager';

// Each test gets a fresh in-memory database (init accepts an explicit path)
function makeDb() {
    const db = new DatabaseManager();
    db.init(':memory:');
    return db;
}

describe('DatabaseManager — karma batching', () => {
    let db: DatabaseManager;

    beforeEach(() => {
        db = makeDb();
    });

    it('accumulates karma deltas in memory until flush', () => {
        db.addVote('alice', 'light_heal', 'positive');
        db.addVote('alice', 'light_heal', 'positive');
        db.addVote('alice', 'push_back', 'negative');

        // getViewerKarma flushes first, so the balance reflects all three votes
        expect(db.getViewerKarma('alice')).toBe(1); // +1 +1 -1
    });

    it('tracks negative votes and rounds separately', () => {
        db.addVote('bob', 'push_back', 'negative');
        db.addVote('bob', 'blackout', 'psychological');
        db.addVote('bob', 'light_heal', 'positive');

        const stats = db.getViewerStats('bob');
        expect(stats).not.toBeNull();
        expect(stats!.karma).toBe(-1); // -1 -1 +1
        expect(stats!.negativeVotes).toBe(2);
        expect(stats!.roundsVoted).toBe(3);
    });

    it('orders the leaderboard by karma desc', () => {
        db.addVote('low', 'papercut', 'negative');
        db.addVote('high', 'light_heal', 'positive');
        db.addVote('high', 'light_heal', 'positive');

        const top = db.getTopKarma(5);
        expect(top[0].username).toBe('high');
        expect(top[0].karma).toBe(2);
        expect(top[1].username).toBe('low');
    });

    it('reports the most hostile viewer', () => {
        db.addVote('hostile', 'blackout', 'psychological');
        db.addVote('hostile', 'push_back', 'negative');
        db.addVote('mild', 'push_back', 'negative');

        const worst = db.getTopNegative(1)[0];
        expect(worst.username).toBe('hostile');
        expect(worst.negativeVotes).toBe(2);
    });
});

describe('DatabaseManager — spendKarma', () => {
    let db: DatabaseManager;

    beforeEach(() => {
        db = makeDb();
    });

    it('refuses to spend more than the balance', () => {
        db.addVote('alice', 'light_heal', 'positive'); // +1
        expect(db.spendKarma('alice', 20)).toBe(false);
        expect(db.getViewerKarma('alice')).toBe(1);
    });

    it('withdraws karma and records the spend', () => {
        for (let i = 0; i < 25; i++) db.addVote('alice', 'light_heal', 'positive');

        expect(db.spendKarma('alice', 20)).toBe(true);
        const stats = db.getViewerStats('alice');
        expect(stats!.karma).toBe(5);
        expect(stats!.karmaSpent).toBe(20);
    });

    it('is atomic under concurrent attempts (second spend fails)', () => {
        for (let i = 0; i < 25; i++) db.addVote('alice', 'light_heal', 'positive');

        expect(db.spendKarma('alice', 20)).toBe(true);
        expect(db.spendKarma('alice', 20)).toBe(false);
        expect(db.getViewerKarma('alice')).toBe(5);
    });

    it('returns false for unknown viewers', () => {
        expect(db.spendKarma('ghost', 10)).toBe(false);
    });
});

describe('DatabaseManager — migration', () => {
    it('is idempotent: re-init on the same file keeps columns intact', () => {
        const db = new DatabaseManager();
        db.init(':memory:');
        db.addVote('alice', 'light_heal', 'positive');
        expect(db.getViewerKarma('alice')).toBe(1);
        db.close();
    });
});