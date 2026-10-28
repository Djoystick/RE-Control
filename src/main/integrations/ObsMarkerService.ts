import * as fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { OBSWebSocket } from 'obs-websocket-js'
import { sysLogger } from '../utils/logger'

/**
 * OBS-маркеры (v1.5.0).
 *
 * При MEGA / Traitor / панике ставим маркер в текущую запись OBS Studio,
 * чтобы стримеру не приходилось вспоминать моменты для нарезки.
 * Подключение опциональное: без OBS всё молча деградирует.
 *
 * Требует включённого WebSocket-сервера в OBS (Инструменты → WebSocket)
 * и OBS ≥ 28 для команды CreateRecordChapter.
 */

export interface ObsConfig {
    enabled: boolean;
    url: string;
    password: string;
}

const DEFAULT_CONFIG: ObsConfig = {
    enabled: false,
    url: 'ws://127.0.0.1:4455',
    password: ''
};

export class ObsMarkerService {
    private config: ObsConfig = { ...DEFAULT_CONFIG };
    private client: OBSWebSocket | null = null;
    private connecting: Promise<boolean> | null = null;
    private connected = false;

    private getConfigPath(): string {
        return join(app.getPath('userData'), 'obs_config.json');
    }

    loadConfig(): ObsConfig {
        try {
            if (fs.existsSync(this.getConfigPath())) {
                const raw = JSON.parse(fs.readFileSync(this.getConfigPath(), 'utf8'));
                this.config = { ...DEFAULT_CONFIG, ...raw };
            }
        } catch {
            sysLogger.warn('[OBS] Failed to read obs_config.json, markers disabled');
        }
        return { ...this.config };
    }

    getConfig(): ObsConfig {
        return { ...this.config };
    }

    setConfig(patch: Partial<ObsConfig>): ObsConfig {
        this.config = { ...this.config, ...patch };
        try {
            fs.writeFileSync(this.getConfigPath(), JSON.stringify(this.config, null, 2));
        } catch {
            sysLogger.error('[OBS] Failed to persist obs_config.json');
        }
        // Reconnect with new settings
        this.reset();
        return { ...this.config };
    }

    private reset() {
        try { this.client?.disconnect(); } catch {}
        this.client = null;
        this.connected = false;
        this.connecting = null;
    }

    private async ensureConnected(): Promise<boolean> {
        if (!this.config.enabled) return false;
        if (this.connected && this.client) return true;
        if (this.connecting) return this.connecting;

        this.connecting = (async () => {
            try {
                const client = new OBSWebSocket();
                await client.connect(this.config.url, this.config.password || undefined);
                this.client = client;
                this.connected = true;

                client.on('ConnectionClosed', () => {
                    this.connected = false;
                    sysLogger.warn('[OBS] Connection closed — markers disabled until reconnect');
                });

                sysLogger.info(`[OBS] Connected to ${this.config.url} — markers enabled`);
                return true;
            } catch (err: any) {
                this.connected = false;
                this.client = null;
                sysLogger.warn(`[OBS] Not connected (${err?.message || err}) — markers skipped`);
                return false;
            } finally {
                this.connecting = null;
            }
        })();

        return this.connecting;
    }

    /**
     * Ставит маркер в текущую запись.
     * @param label короткая подпись (MEGA / TRAITOR / PANIC)
     */
    async mark(label: string): Promise<boolean> {
        if (!(await this.ensureConnected())) return false;
        try {
            await this.client!.call('CreateRecordChapter', { chapterName: label });
            sysLogger.info(`[OBS] Record chapter marker: ${label}`);
            return true;
        } catch (err: any) {
            sysLogger.warn(`[OBS] Marker failed (${err?.message || err}) — recording may be off`);
            return false;
        }
    }

    /** Диагностика для UI: подключено ли сейчас */
    isConnected(): boolean {
        return this.connected;
    }
}

export const obsMarkerService = new ObsMarkerService();