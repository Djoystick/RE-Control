import fs from 'node:fs/promises';
import path from 'node:path';

export class REBridge {
    private dataPath: string;
    private queue: Promise<any> = Promise.resolve();

    constructor() {
        const { app } = require('electron');
        const configPath = path.join(app.getPath('userData'), 'game_config.json');
        let gameDir = 'C:\\';
        try {
            const conf = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
            if (conf.gamePath) gameDir = conf.gamePath;
        } catch (e) {}
        this.dataPath = path.join(gameDir, 'reframework', 'data');
        try { require('fs').mkdirSync(this.dataPath, { recursive: true }); } catch(e) {}
    }

    async sendCommand(cmd: string, _args: any = {}): Promise<string> {
        const execute = async () => {
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
        };

        const resultPromise = this.queue.then(execute);
        this.queue = resultPromise.catch(() => {});
        return resultPromise as Promise<string>;
    }
}

