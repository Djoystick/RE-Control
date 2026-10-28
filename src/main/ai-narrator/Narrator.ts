import * as fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { sysLogger } from '../utils/logger'
import { EventEmitter } from 'events'
import { pickLine, LINE_REGISTRY, type VoicePreset } from './LineRegistry'
import { ttsService } from './TTSService'

// ═══════════════════════════════════════════════════════
//  UMBRELLA CORPORATION — AUDIO NARRATOR (WITH WEB AUDIO)
// ═══════════════════════════════════════════════════════
//
// Источник звука по приоритету:
//   1. актёрская запись .ogg/.mp3/.wav из assets/audio/<preset>/<prefix>*
//   2. TTS-кэш / синтез Edge TTS (если включён и доступен)
// Если нет ни того, ни другого — тишина и запись в лог.

export function getAudioBasePath(): string {
    if (app && app.isPackaged) {
        const prodPath = join(process.resourcesPath, 'assets', 'audio');
        if (fs.existsSync(prodPath)) return prodPath;
    }
    const appPath = app ? join(app.getAppPath(), 'assets', 'audio') : '';
    if (appPath && fs.existsSync(appPath)) return appPath;
    return join(process.cwd(), 'assets', 'audio');
}

/** Профиль → папка актёрских записей */
const FOLDER_BY_PRESET: Record<VoicePreset, string> = {
    umbrella_hq: 'umbrella_hq',
    ally_radio: 'ally_radio',
    traitor: 'traitor'
};

export class Narrator extends EventEmitter {
    private enabled: boolean = true
    private cooldownMs: number = 1000
    private lastSpokenAt: number = 0
    private volume: number = 0.8

    setEnabled(val: boolean) {
        this.enabled = val
        sysLogger.info(`[Narrator] ${val ? 'Включён' : 'Отключён'}`)
    }

    setVolume(val: number) {
        this.volume = Math.max(0, Math.min(1, val))
        sysLogger.info(`[Narrator] Громкость установлена: ${Math.round(this.volume * 100)}%`)
    }

    private canSpeak(): boolean {
        if (!this.enabled) return false
        return Date.now() - this.lastSpokenAt >= this.cooldownMs
    }

    /** Ищет случайную актёрскую запись для события. null, если файлов нет. */
    private async findActorFile(preset: VoicePreset, prefix: string): Promise<string | null> {
        const folder = join(getAudioBasePath(), FOLDER_BY_PRESET[preset])
        if (!fs.existsSync(folder)) return null

        try {
            const entries = await fs.promises.readdir(folder)
            const files = entries.filter(f =>
                (f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')) &&
                f.startsWith(prefix)
            )
            if (files.length === 0) return null
            return join(folder, files[Math.floor(Math.random() * files.length)])
        } catch {
            return null
        }
    }

    async say(eventType: string) {
        if (!this.canSpeak()) return

        const line = pickLine(eventType)
        if (!line) return

        this.lastSpokenAt = Date.now()

        // 1) Актёрская запись — приоритетный источник
        const actorFile = await this.findActorFile(line.preset, line.prefix)
        if (actorFile) {
            try {
                const buffer = await fs.promises.readFile(actorFile)
                this.emit('narrator:audio', {
                    type: eventType,
                    subtitle: line.text,
                    base64: buffer.toString('base64'),
                    mime: actorFile.endsWith('.ogg') ? 'audio/ogg'
                        : actorFile.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg',
                    source: 'actor',
                    volume: this.volume
                })
                sysLogger.info(`[Narrator] Actor line: ${actorFile.split(/[\\/]/).pop()}`)
                return
            } catch (err: any) {
                sysLogger.warn(`[Narrator] Actor file unreadable (${err.message}), trying TTS`)
            }
        }

        // 2) TTS-фолбэк (кэш или синтез)
        if (ttsService.isEnabled()) {
            const tts = await ttsService.synthesize(line.text, line.preset)
            if (tts) {
                this.emit('narrator:audio', {
                    type: eventType,
                    subtitle: line.text,
                    base64: tts.base64,
                    mime: tts.mime,
                    source: 'tts',
                    volume: this.volume
                })
                sysLogger.info(`[Narrator] TTS line for ${eventType}`)
                return
            }
        }

        // 3) Только субтитр (звука нет) — чтобы зритель всё равно увидел текст
        this.emit('narrator:subtitle', { type: eventType, subtitle: line.text })
        sysLogger.info(`[Narrator] No audio for ${eventType} (no actor files, TTS disabled/unavailable) — subtitle only`)
    }
}

export const narrator = new Narrator()

/** Все реплики реестра — для прогрева TTS-кэша на старте */
export function getAllLines(): { text: string; preset: VoicePreset }[] {
    const lines: { text: string; preset: VoicePreset }[] = []
    for (const def of Object.values(LINE_REGISTRY)) {
        for (const text of def.variants) {
            lines.push({ text, preset: def.preset })
        }
    }
    return lines
}