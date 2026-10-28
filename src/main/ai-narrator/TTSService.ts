import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { execFile } from 'child_process'
import { app } from 'electron'
import { sysLogger } from '../utils/logger'
import type { VoicePreset } from './LineRegistry'

// ═══════════════════════════════════════════════════════
//  TTS FALLBACK — Edge TTS (ru-RU) с дисковым кэшем
// ═══════════════════════════════════════════════════════
//
// Спайк (см. local_docs/tts_plan.md §1.1) показал:
//  - plain-синтез стабилен;
//  - rate/pitch в запросе роняют сессию → тембр делаем позже через ffmpeg.
// Поэтому здесь только voice + text.

const VOICE_BY_PRESET: Record<VoicePreset, string> = {
    umbrella_hq: 'ru-RU-DmitryNeural',
    ally_radio: 'ru-RU-SvetlanaNeural',
    traitor: 'ru-RU-DmitryNeural'
};

interface TTSConfig {
    enabled: boolean;
    /** Дополнительные аргументы python-команды, если нужен кастомный путь */
    pythonCommand?: string;
}

const DEFAULT_CONFIG: TTSConfig = { enabled: true };

export class TTSService {
    private config: TTSConfig = { ...DEFAULT_CONFIG };
    private pythonAvailable: boolean | null = null;
    private inflight = new Map<string, Promise<{ base64: string; mime: string } | null>>();

    private getCacheDir(): string {
        const dir = path.join(app.getPath('userData'), 'tts_cache');
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
        return dir;
    }

    private getConfigPath(): string {
        return path.join(app.getPath('userData'), 'tts_config.json');
    }

    loadConfig(): TTSConfig {
        try {
            if (fs.existsSync(this.getConfigPath())) {
                const raw = JSON.parse(fs.readFileSync(this.getConfigPath(), 'utf8'));
                this.config = { ...DEFAULT_CONFIG, ...raw };
            }
        } catch (err) {
            sysLogger.warn('[TTS] Failed to read tts_config.json, using defaults');
        }
        return { ...this.config };
    }

    getConfig(): TTSConfig {
        return { ...this.config };
    }

    setConfig(patch: Partial<TTSConfig>): TTSConfig {
        this.config = { ...this.config, ...patch };
        try {
            fs.writeFileSync(this.getConfigPath(), JSON.stringify(this.config, null, 2));
        } catch (err) {
            sysLogger.error('[TTS] Failed to persist tts_config.json');
        }
        sysLogger.info(`[TTS] Config updated: enabled=${this.config.enabled}`);
        return { ...this.config };
    }

    isEnabled(): boolean {
        return this.config.enabled;
    }

    /** Проверяет, доступен ли python + edge-tts (один раз за сессию) */
    async checkAvailability(): Promise<boolean> {
        if (this.pythonAvailable !== null) return this.pythonAvailable;

        const python = this.config.pythonCommand || 'python';
        this.pythonAvailable = await new Promise<boolean>((resolve) => {
            execFile(python, ['-c', 'import edge_tts'], { timeout: 10000 }, (error) => {
                if (error) {
                    sysLogger.warn(`[TTS] edge-tts not available (${python}): ${error.message}. Falling back to silence.`);
                    resolve(false);
                } else {
                    sysLogger.info(`[TTS] edge-tts is available via "${python}"`);
                    resolve(true);
                }
            });
        });
        return this.pythonAvailable;
    }

    private cacheKey(text: string, voice: string): string {
        return crypto.createHash('sha1').update(`${voice}|${text}`).digest('hex');
    }

    private cachePath(key: string): string {
        return path.join(this.getCacheDir(), `${key}.mp3`);
    }

    /** Синтезирует (или достаёт из кэша) реплику. null = TTS недоступен. */
    async synthesize(text: string, preset: VoicePreset): Promise<{ base64: string; mime: string } | null> {
        if (!this.config.enabled) return null;

        const voice = VOICE_BY_PRESET[preset] ?? VOICE_BY_PRESET.umbrella_hq;
        const key = this.cacheKey(text, voice);
        const cached = this.cachePath(key);

        if (fs.existsSync(cached)) {
            try {
                const buffer = await fs.promises.readFile(cached);
                return { base64: buffer.toString('base64'), mime: 'audio/mpeg' };
            } catch (err) {
                sysLogger.warn(`[TTS] Cache read failed for ${key}, re-synthesizing`);
            }
        }

        // Deduplicate concurrent requests for the same line
        const existing = this.inflight.get(key);
        if (existing) return existing;

        const task = this.runSynthesis(text, voice, cached).finally(() => {
            this.inflight.delete(key);
        });
        this.inflight.set(key, task);
        return task;
    }

    private async runSynthesis(text: string, voice: string, targetPath: string): Promise<{ base64: string; mime: string } | null> {
        if (!(await this.checkAvailability())) return null;

        const python = this.config.pythonCommand || 'python';
        const tmpPath = `${targetPath}.tmp.mp3`;

        const args = [
            '-m', 'edge_tts',
            '--voice', voice,
            '--text', text,
            '--write-media', tmpPath
        ];

        try {
            await new Promise<void>((resolve, reject) => {
                execFile(python, args, { timeout: 30000 }, (error, _stdout, stderr) => {
                    if (error) {
                        reject(new Error(`${error.message}${stderr ? ` | ${String(stderr).slice(0, 200)}` : ''}`));
                    } else {
                        resolve();
                    }
                });
            });

            const stat = await fs.promises.stat(tmpPath);
            if (stat.size === 0) throw new Error('empty audio file');

            await fs.promises.rename(tmpPath, targetPath);
            const buffer = await fs.promises.readFile(targetPath);
            sysLogger.info(`[TTS] Synthesized "${text.slice(0, 40)}..." with ${voice} (${stat.size} bytes)`);
            return { base64: buffer.toString('base64'), mime: 'audio/mpeg' };
        } catch (err: any) {
            sysLogger.error(`[TTS] Synthesis failed: ${err.message}`);
            try { await fs.promises.unlink(tmpPath); } catch {}
            return null;
        }
    }

    /**
     * Прогрев кэша на старте: синтезирует все реплики реестра в фоне,
     * чтобы во время стрима не было задержки 1–3с.
     */
    async warmCache(lines: { text: string; preset: VoicePreset }[]): Promise<number> {
        if (!this.config.enabled) return 0;
        if (!(await this.checkAvailability())) return 0;

        let generated = 0;
        for (const line of lines) {
            const result = await this.synthesize(line.text, line.preset);
            if (result) generated++;
        }
        sysLogger.info(`[TTS] Cache warm-up finished: ${generated}/${lines.length} lines ready`);
        return generated;
    }
}

export const ttsService = new TTSService();