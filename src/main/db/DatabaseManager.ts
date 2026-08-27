import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { sysLogger } from '../utils/logger';

export interface Viewer {
    username: string;
    karma: number;
}

export class DatabaseManager {
    private db: Database.Database | null = null;

    init() {
        try {
            const dbPath = join(app.getPath('userData'), 're_control_data.sqlite');
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');

            this.db.exec(`
                CREATE TABLE IF NOT EXISTS viewers (
                    username TEXT PRIMARY KEY,
                    karma INTEGER DEFAULT 0
                )
            `);
            sysLogger.info(`Database initialized at ${dbPath}`);
        } catch (error) {
            sysLogger.error('Failed to initialize database: ' + error);
        }
    }

    addVote(username: string, effectId: string) {
        if (!this.db) return;
        try {
            const stmt = this.db.prepare(`
                INSERT INTO viewers (username, karma)
                VALUES (?, 1)
                ON CONFLICT(username) DO UPDATE SET karma = karma + 1
            `);
            stmt.run(username);
            sysLogger.info(`Added karma to ${username} for voting on ${effectId}`);
        } catch (error) {
            sysLogger.error('Failed to add vote to db: ' + error);
        }
    }

    getTopKarma(limit: number = 5): Viewer[] {
        if (!this.db) return [];
        try {
            const stmt = this.db.prepare('SELECT username, karma FROM viewers ORDER BY karma DESC LIMIT ?');
            return stmt.all(limit) as Viewer[];
        } catch (error) {
            sysLogger.error('Failed to get top karma: ' + error);
            return [];
        }
    }
}

export const dbManager = new DatabaseManager();
