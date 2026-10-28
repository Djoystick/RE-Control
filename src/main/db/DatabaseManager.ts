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
    private karmaBatch: Map<string, number> = new Map();
    private flushInterval: NodeJS.Timeout | null = null;

    init(customDbPath?: string) {
        try {
            const dbPath = customDbPath || join(app.getPath('userData'), 're_control_data.sqlite');
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');

            this.db.exec(`
                CREATE TABLE IF NOT EXISTS viewers (
                    username TEXT PRIMARY KEY,
                    karma INTEGER DEFAULT 0
                )
            `);
            
            // Запуск периодического сброса пакета голосов раз в 300 мс
            if (this.flushInterval) clearInterval(this.flushInterval);
            this.flushInterval = setInterval(() => this.flush(), 300);

            sysLogger.info(`Database initialized with WAL and 300ms batching at ${dbPath}`);
        } catch (error) {
            sysLogger.error('Failed to initialize database: ' + error);
        }
    }

    addVote(username: string, _effectId: string, category: string = 'positive') {
        const karmaDelta = category === 'positive' ? 1 : -1;
        const current = this.karmaBatch.get(username) || 0;
        this.karmaBatch.set(username, current + karmaDelta);
        // Не блокируем Event Loop синхронным SQLite на каждый голос
    }

    flush() {
        if (!this.db || this.karmaBatch.size === 0) return;
        const batch = new Map(this.karmaBatch);
        this.karmaBatch.clear();

        try {
            const updateKarmaTx = this.db.transaction((entries: [string, number][]) => {
                const stmt = this.db!.prepare(`
                    INSERT INTO viewers (username, karma)
                    VALUES (?, ?)
                    ON CONFLICT(username) DO UPDATE SET karma = karma + ?
                `);
                for (const [user, delta] of entries) {
                    stmt.run(user, delta, delta);
                }
            });

            updateKarmaTx(Array.from(batch.entries()));
            sysLogger.info(`[DatabaseManager] Flushed karma batch of ${batch.size} viewers`);
        } catch (error) {
            sysLogger.error('Failed to flush karma batch to db: ' + error);
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
