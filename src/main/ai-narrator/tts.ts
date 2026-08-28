import { exec } from 'child_process'
import { join } from 'path'
import { sysLogger } from '../utils/logger'

const SCRIPT = join(process.cwd(), 'scripts', 'narrator_speak.py')
const EDGE_TTS_PKG = join(process.cwd(), 'scripts', 'edge_tts_pkg')

export function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
        const env = { ...process.env, PYTHONPATH: EDGE_TTS_PKG }
        // Sanitize text for command line
        const safeText = text.replace(/["']/g, '')
        
        exec(`python "${SCRIPT}" "${safeText}"`, { env }, (err, stdout, stderr) => {
            if (err) {
                sysLogger.error(`[Narrator] TTS exec error: ${err.message}`)
                sysLogger.error(`[Narrator] stderr: ${stderr}`)
                sysLogger.error(`[Narrator] stdout: ${stdout}`)
            }
            resolve()
        })
    })
}
