import * as fs from 'fs'
import { join } from 'path'
import { sysLogger } from '../utils/logger'

// ═══════════════════════════════════════════════════════
//  UMBRELLA CORPORATION — AUDIO NARRATOR (WITH WEB AUDIO)
// ═══════════════════════════════════════════════════════

const FOLDERS: Record<string, string> = {
    veto: join(process.cwd(), 'assets', 'audio', 'umbrella_hq'),
    invert: join(process.cwd(), 'assets', 'audio', 'umbrella_hq'),
    blind: join(process.cwd(), 'assets', 'audio', 'umbrella_hq'),
    equalize: join(process.cwd(), 'assets', 'audio', 'umbrella_hq'),
    turbo: join(process.cwd(), 'assets', 'audio', 'umbrella_hq'),
    negative_win: join(process.cwd(), 'assets', 'audio', 'umbrella_hq'),
    positive_win: join(process.cwd(), 'assets', 'audio', 'ally_radio'),
    traitor: join(process.cwd(), 'assets', 'audio', 'traitor'),
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

    setEnabled(val: boolean) {
        this.enabled = val
        sysLogger.info(`[Narrator] ${val ? 'Включён' : 'Отключён'}`)
    }

    private canSpeak(): boolean {
        if (!this.enabled) return false
        return Date.now() - this.lastSpokenAt >= this.cooldownMs
    }

    say(eventType: string) {
        if (!this.canSpeak()) return

        const folder = FOLDERS[eventType]
        if (!folder || !fs.existsSync(folder)) return

        this.lastSpokenAt = Date.now()
        
        try {
            
            let prefix = eventType;
            if (eventType === 'negative_win') prefix = 'neg';
            if (eventType === 'positive_win') prefix = 'pos';
            
            const files = fs.readdirSync(folder).filter(f => 
                (f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')) &&
                f.startsWith(prefix)
            )

            if (files.length === 0) return
            
            const randomFile = files[Math.floor(Math.random() * files.length)]
            const filePath = join(folder, randomFile)
            
            // Read file and convert to base64
            const buffer = fs.readFileSync(filePath)
            const base64 = buffer.toString('base64')
            
            // Send directly to overlay to be played with VFX
            this.emit('narrator:audio', {
                type: eventType,
                subtitle: SUBTITLES[eventType] || '',
                base64: base64
            })
            sysLogger.info(`[Narrator VFX] Sent audio to overlay: ${randomFile}`)
        } catch (err: any) {
            sysLogger.error(`[Narrator VFX Error] ${err.message}`)
        }
    }
}

export const narrator = new Narrator()
