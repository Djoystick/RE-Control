import fs from 'node:fs/promises';
import path from 'node:path';

export class REBridge {
    private dataPath: string;

    constructor() {
        this.dataPath = process.env.GAME_DATA_PATH || 'E:\\Resident Evil Village\\reframework\\data';
    }

    async sendCommand(cmd: string, _args: any = {}): Promise<string> {
        const inFile = path.join(this.dataPath, 'RE_Control_in.txt');
        const outFile = path.join(this.dataPath, 'RE_Control_out.txt');

        // Отправляем просто строку команды (например "heal_full") для совместимости с Lua парсером
        const payload = cmd;
        
        await fs.writeFile(inFile, payload, 'utf-8');

        return new Promise((resolve, reject) => {
            const timeoutTime = Date.now() + 5000;
            
            const interval = setInterval(async () => {
                if (Date.now() > timeoutTime) {
                    clearInterval(interval);
                    reject(new Error('Timeout waiting for game response'));
                    return;
                }

                try {
                    const stats = await fs.stat(outFile);
                    if (stats.size > 0) {
                        const data = await fs.readFile(outFile, 'utf-8');
                        await fs.unlink(outFile);
                        clearInterval(interval);
                        resolve(data);
                    }
                } catch (err: any) {
                    if (err.code !== 'ENOENT') {
                        clearInterval(interval);
                        reject(err);
                    }
                }
            }, 100);
        });
    }
}

