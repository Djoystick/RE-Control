import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

class Logger {
    private logFile: string;

    constructor() {
        // In dev, use project root. In prod, use appData.
        this.logFile = path.join(app.isPackaged ? app.getPath('userData') : process.cwd(), 're_control_system.log');
        // Clear log on startup
        fs.writeFileSync(this.logFile, '=== RE:CONTROL LOG STARTED AT ' + new Date().toISOString() + ' ===\n');
    }

    info(msg: string, ...args: any[]) {
        this.write('INFO', msg, ...args);
    }

    warn(msg: string, ...args: any[]) {
        this.write('WARN', msg, ...args);
    }

    error(msg: string, ...args: any[]) {
        this.write('ERROR', msg, ...args);
    }

    private write(level: string, msg: string, ...args: any[]) {
        const timestamp = new Date().toISOString();
        let logLine = '[' + timestamp + '] [' + level + '] ' + msg;
        if (args.length > 0) {
            logLine += ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        }
        
        console.log(logLine); // Terminal
        fs.appendFileSync(this.logFile, logLine + '\n'); // File
    }
}

export const sysLogger = new Logger();

