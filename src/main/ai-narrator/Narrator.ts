import * as fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { sysLogger } from '../utils/logger'

// ═══════════════════════════════════════════════════════
//  UMBRELLA CORPORATION — AUDIO NARRATOR (WITH WEB AUDIO)
// ═══════════════════════════════════════════════════════

export function getAudioBasePath(): string {
    if (app && app.isPackaged) {
        const prodPath = join(process.resourcesPath, 'assets', 'audio');
        if (fs.existsSync(prodPath)) return prodPath;
    }
    const appPath = app ? join(app.getAppPath(), 'assets', 'audio') : '';
    if (appPath && fs.existsSync(appPath)) return appPath;
    return join(process.cwd(), 'assets', 'audio');
}

const SUBFOLDER_MAP: Record<string, string> = {
    veto: 'umbrella_hq',
    invert: 'umbrella_hq',
    blind: 'umbrella_hq',
    equalize: 'umbrella_hq',
    turbo: 'umbrella_hq',
    negative_win: 'umbrella_hq',
    positive_win: 'ally_radio',
    traitor: 'traitor',
}

const SUBTITLES: Record<string, string> = {
    veto: 'Аномалия ликвидирована.',
    invert: 'Иерархия пересмотрена.',
    blind: 'Сенсорное затемнение активировано.',
    equalize: 'Паритет восстановлен.',
    turbo: 'Сжатие времени активировано.',
    traitor: 'Верификация агента завершена.',
    negative_win: 'Оптимальный исход достигнут.',
    positive_win: 'Припасы отправлены. Держись!',
}

import { EventEmitter } from 'events'

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

    async say(eventType: string) {
        if (!this.canSpeak()) return

        const subfolder = SUBFOLDER_MAP[eventType]
        if (!subfolder) return
        const folder = join(getAudioBasePath(), subfolder)
        if (!fs.existsSync(folder)) return

        this.lastSpokenAt = Date.now()
        
        try {
            let prefix = eventType;
            if (eventType === 'negative_win') prefix = 'neg';
            if (eventType === 'positive_win') prefix = 'pos';
            
            const entries = await fs.promises.readdir(folder);
            const files = entries.filter(f => 
                (f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')) &&
                f.startsWith(prefix)
            )

            if (files.length === 0) return
            
            const randomFile = files[Math.floor(Math.random() * files.length)]
            const filePath = join(folder, randomFile)
            
            // Non-blocking async file read
            const buffer = await fs.promises.readFile(filePath)
            const base64 = buffer.toString('base64')
            
            // Send directly to overlay to be played with VFX
            this.emit('narrator:audio', {
                type: eventType,
                subtitle: SUBTITLES[eventType] || '',
                base64: base64,
                volume: this.volume
            })
            sysLogger.info(`[Narrator VFX] Sent audio to overlay: ${randomFile} (volume: ${Math.round(this.volume * 100)}%)`)
        } catch (err: any) {
            sysLogger.error(`[Narrator VFX Error] ${err.message}`)
        }
    }
}

export const narrator = new Narrator()
