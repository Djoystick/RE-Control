import * as fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { sysLogger } from '../utils/logger'

/**
 * Персистентность сессии Директора.
 *
 * Без этого рестарт приложения посреди стрима обнулял бы статистику:
 * номер раунда, серию негативных побед и кулдаун недавних победителей.
 * Слепок пишется при stop()/panicStop() и загружается при старте.
 */

export interface DirectorSession {
    roundNumber: number;
    negativeWinStreak: number;
    recentWinners: string[];
    /** Победы по эффектам за сессию (для витрины редких) */
    winRounds: Record<string, number>;
    /** Накопленные MEGA-моменты */
    megaMoments: string[];
}

const EMPTY_SESSION: DirectorSession = {
    roundNumber: 0,
    negativeWinStreak: 0,
    recentWinners: [],
    winRounds: {},
    megaMoments: []
};

export class SessionStore {
    private filePath: string;

    constructor(fileName: string = 'session_state.json') {
        try {
            this.filePath = join(app.getPath('userData'), fileName);
        } catch {
            this.filePath = join(process.cwd(), fileName);
        }
    }

    load(): DirectorSession {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
                return {
                    roundNumber: typeof raw.roundNumber === 'number' ? raw.roundNumber : 0,
                    negativeWinStreak: typeof raw.negativeWinStreak === 'number' ? raw.negativeWinStreak : 0,
                    recentWinners: Array.isArray(raw.recentWinners) ? raw.recentWinners : [],
                    winRounds: raw.winRounds && typeof raw.winRounds === 'object' ? raw.winRounds : {},
                    megaMoments: Array.isArray(raw.megaMoments) ? raw.megaMoments : []
                };
            }
        } catch (err) {
            sysLogger.warn('[Session] Failed to load session_state.json, starting fresh');
        }
        return { ...EMPTY_SESSION };
    }

    save(session: DirectorSession): void {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(session, null, 2));
            sysLogger.info(`[Session] Saved session state (round ${session.roundNumber})`);
        } catch (err) {
            sysLogger.error('[Session] Failed to save session_state.json');
        }
    }

    clear(): void {
        try {
            if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
            sysLogger.info('[Session] Session state cleared');
        } catch {
            // ignore
        }
    }
}

export const sessionStore = new SessionStore();