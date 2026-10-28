import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { sysLogger } from '../utils/logger';

export interface Viewer {
    username: string;
    karma: number;
}

export interface ViewerStats extends Viewer {
    negativeVotes: number;
    roundsVoted: number;
    karmaSpent: number;
}

interface KarmaDelta {
    karma: number;
    negative: number;
    rounds: number;
}

export class DatabaseManager {
    private db: Database.Database | null = null;
    private karmaBatch: Map<string, KarmaDelta> = new Map();
    private flushInterval: NodeJS.Timeout | null = null;

    init(customDbPath?: string) {
        try {
            const dbPath = customDbPath || join(app.getPath('userData'), 're_control_data.sqlite');
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');

            this.db.exec(`
                CREATE TABLE IF NOT EXISTS viewers (
                    username TEXT PRIMARY KEY,
                    karma INTEGER DEFAULT 0,
                    negative_votes INTEGER DEFAULT 0,
                    rounds_voted INTEGER DEFAULT 0,
                    karma_spent INTEGER DEFAULT 0
                )
            `);

            this.migrate();

            // Запуск периодического сброса пакета голосов раз в 300 мс
            if (this.flushInterval) clearInterval(this.flushInterval);
            this.flushInterval = setInterval(() => this.flush(), 300);

            sysLogger.info(`Database initialized with WAL and 300ms batching at ${dbPath}`);
        } catch (error) {
            sysLogger.error('Failed to initialize database: ' + error);
        }
    }

    /** Idempotent migration for databases created before v1.4.0 */
    private migrate() {
        if (!this.db) return;
        const columns = (this.db.prepare('PRAGMA table_info(viewers)').all() as { name: string }[]).map(c => c.name);
        const required: [string, string][] = [
            ['negative_votes', 'INTEGER DEFAULT 0'],
            ['rounds_voted', 'INTEGER DEFAULT 0'],
            ['karma_spent', 'INTEGER DEFAULT 0']
        ];
        for (const [name, def] of required) {
            if (!columns.includes(name)) {
                this.db.exec(`ALTER TABLE viewers ADD COLUMN ${name} ${def}`);
                sysLogger.info(`[DatabaseManager] Migrated: added column viewers.${name}`);
            }
        }
    }

    addVote(username: string, _effectId: string, category: string = 'positive') {
        const karmaDelta = category === 'positive' ? 1 : -1;
        const entry = this.karmaBatch.get(username) || { karma: 0, negative: 0, rounds: 0 };
        entry.karma += karmaDelta;
        if (category !== 'positive') entry.negative += 1;
        entry.rounds += 1;
        this.karmaBatch.set(username, entry);
        // Не блокируем Event Loop синхронным SQLite на каждый голос
    }

    flush() {
        if (!this.db || this.karmaBatch.size === 0) return;
        const batch = new Map(this.karmaBatch);
        this.karmaBatch.clear();

        try {
            const updateKarmaTx = this.db.transaction((entries: [string, KarmaDelta][]) => {
                const stmt = this.db!.prepare(`
                    INSERT INTO viewers (username, karma, negative_votes, rounds_voted)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(username) DO UPDATE SET
                        karma = karma + excluded.karma,
                        negative_votes = negative_votes + excluded.negative_votes,
                        rounds_voted = rounds_voted + excluded.rounds_voted
                `);
                for (const [user, d] of entries) {
                    stmt.run(user, d.karma, d.negative, d.rounds);
                }
            });

            updateKarmaTx(Array.from(batch.entries()));
            sysLogger.info(`[DatabaseManager] Flushed karma batch of ${batch.size} viewers`);
        } catch (error) {
            sysLogger.error('Failed to flush karma batch to db: ' + error);
        }
    }

    /** Atomically withdraw karma (shield/reroll). Returns false when balance is insufficient. */
    spendKarma(username: string, amount: number): boolean {
        this.flush();
        if (!this.db || amount <= 0) return false;
        try {
            const info = this.db.prepare(`
                UPDATE viewers
                SET karma = karma - ?, karma_spent = karma_spent + ?
                WHERE username = ? AND karma >= ?
            `).run(amount, amount, username, amount);
            return info.changes > 0;
        } catch (error) {
            sysLogger.error('Failed to spend karma: ' + error);
            return false;
        }
    }

    getTopKarma(limit: number = 5): Viewer[] {
        // Сначала сбрасываем актуальный буфер из памяти
        this.flush();
        if (!this.db) return [];
        try {
            const stmt = this.db.prepare('SELECT username, karma FROM viewers ORDER BY karma DESC LIMIT ?');
            return stmt.all(limit) as Viewer[];
        } catch (error) {
            sysLogger.error('Failed to get top karma: ' + error);
            return [];
        }
    }

    getLeaderboardFull(limit: number = 5): ViewerStats[] {
        this.flush();
        if (!this.db) return [];
        try {
            const stmt = this.db.prepare(`
                SELECT username, karma, negative_votes AS negativeVotes,
                       rounds_voted AS roundsVoted, karma_spent AS karmaSpent
                FROM viewers ORDER BY karma DESC LIMIT ?
            `);
            return stmt.all(limit) as ViewerStats[];
        } catch (error) {
            sysLogger.error('Failed to get leaderboard: ' + error);
            return [];
        }
    }

    getTopNegative(limit: number = 1): ViewerStats[] {
        this.flush();
        if (!this.db) return [];
        try {
            const stmt = this.db.prepare(`
                SELECT username, karma, negative_votes AS negativeVotes,
                       rounds_voted AS roundsVoted, karma_spent AS karmaSpent
                FROM viewers WHERE negative_votes > 0
                ORDER BY negative_votes DESC LIMIT ?
            `);
            return stmt.all(limit) as ViewerStats[];
        } catch (error) {
            sysLogger.error('Failed to get top negative voters: ' + error);
            return [];
        }
    }

    getViewerKarma(username: string): number {
        this.flush();
        if (!this.db) return 0;
        try {
            const stmt = this.db.prepare('SELECT karma FROM viewers WHERE username = ?');
            const row = stmt.get(username) as { karma: number } | undefined;
            return row?.karma ?? 0;
        } catch (error) {
            sysLogger.error('Failed to get viewer karma: ' + error);
            return 0;
        }
    }

    getViewerStats(username: string): ViewerStats | null {
        this.flush();
        if (!this.db) return null;
        try {
            const stmt = this.db.prepare(`
                SELECT username, karma, negative_votes AS negativeVotes,
                       rounds_voted AS roundsVoted, karma_spent AS karmaSpent
                FROM viewers WHERE username = ?
            `);
            return (stmt.get(username) as ViewerStats | undefined) ?? null;
        } catch (error) {
            sysLogger.error('Failed to get viewer stats: ' + error);
            return null;
        }
    }

    close() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flush();
        if (this.db) {
            try {
                this.db.close();
            } catch (err) {
                sysLogger.warn('Error closing database: ' + err);
            }
            this.db = null;
        }
    }
}

export const dbManager = new DatabaseManager();