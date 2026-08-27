import { spawn } from 'child_process'
import { join } from 'path'
import { sysLogger } from '../utils/logger'

const SCRIPT = join(process.cwd(), 'scripts', 'narrator_speak.py')
const EDGE_TTS_PKG = join(process.cwd(), 'scripts', 'edge_tts_pkg')

/**
 * Speak text using Microsoft Edge TTS (Russian neural voice: Dmitry).
 * Generates MP3 via Python edge-tts, plays it via PowerShell MediaPlayer.
 * Non-blocking: resolves immediately, audio plays in detached subprocess.
 */
export function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
        const env = { ...process.env, PYTHONPATH: EDGE_TTS_PKG }
        const child = spawn('python', [SCRIPT, text], {
            env,
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
        })

        child.on('error', (err) => {
            sysLogger.warn('[Narrator] TTS spawn error: ' + err.message)
        })

        // Detach so it runs in background, don''t block the event loop
        child.unref()
        resolve()
    })
}
