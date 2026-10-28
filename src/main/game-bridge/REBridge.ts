import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';

export interface BridgeCommand {
    id: string;
    method: string;
    params?: any;
    timestamp: number;
    ttl?: number;
}

export interface BridgeResponse {
    id: string;
    status: 'SUCCESS' | 'ERROR' | 'UNKNOWN_COMMAND';
    result?: any;
    error?: string;
}

export class REBridge {
    private queue: Promise<any> = Promise.resolve();
    private pendingCount: number = 0;
    public static readonly MAX_QUEUE_SIZE: number = 10;

    public getPendingCount(): number {
        return this.pendingCount;
    }

    private getDataPath(): string {
        const configPath = path.join(app.getPath('userData'), 'game_config.json');
        let gameDir = 'C:\\';
        try {
            const conf = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
            if (conf.gamePath) gameDir = conf.gamePath;
        } catch (e) {}
        const dataPath = path.join(gameDir, 'reframework', 'data');
        try { require('fs').mkdirSync(dataPath, { recursive: true }); } catch(e) {}
        return dataPath;
    }

    async sendCommand(cmd: string, args: any = {}): Promise<string> {
        if (this.pendingCount >= REBridge.MAX_QUEUE_SIZE) {
            return Promise.reject(new Error(`Bridge queue limit reached (${this.pendingCount}/${REBridge.MAX_QUEUE_SIZE}). Command dropped.`));
        }

        this.pendingCount++;
        const createdAt = Date.now();
        const ttl = 5000;

        const execute = async (): Promise<string> => {
            // If command expired in queue before starting, discard it without writing to disk
            if (Date.now() - createdAt > ttl) {
                throw new Error(`Command ${cmd} expired in bridge queue (TTL ${ttl}ms exceeded)`);
            }

            const dataPath = this.getDataPath();
            const inFile = path.join(dataPath, 'RE_Control_in.txt');
            const inTmpFile = path.join(dataPath, 'RE_Control_in.tmp');
            const outFile = path.join(dataPath, 'RE_Control_out.txt');

            const commandId = crypto.randomUUID ? crypto.randomUUID() : `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const payload: BridgeCommand = {
                id: commandId,
                method: cmd,
                params: args,
                timestamp: Date.now(),
                ttl: ttl
            };

            // Atomic write: write to .tmp and rename to .txt
            const jsonString = JSON.stringify(payload);
            await fs.writeFile(inTmpFile, jsonString, 'utf-8');
            try {
                await fs.rename(inTmpFile, inFile);
            } catch {
                await fs.writeFile(inFile, jsonString, 'utf-8');
                try { await fs.unlink(inTmpFile); } catch {}
            }

            return new Promise<string>((resolve, reject) => {
                const timeoutTime = Date.now() + 5000;

                const interval = setInterval(async () => {
                    if (Date.now() > timeoutTime) {
                        clearInterval(interval);
                        try { await fs.unlink(inFile); } catch {}
                        reject(new Error(`Timeout waiting for game response for command ${cmd} (${commandId})`));
                        return;
                    }

                    try {
                        const stats = await fs.stat(outFile);
                        if (stats.size > 0) {
                            const data = await fs.readFile(outFile, 'utf-8');
                            let parsed: BridgeResponse | null = null;
                            try {
                                parsed = JSON.parse(data.trim());
                            } catch {
                                parsed = {
                                    id: commandId,
                                    status: data.includes('SUCCESS') ? 'SUCCESS' : 'ERROR',
                                    result: data.trim()
                                };
                            }

                            // Verify correlation ID
                            if (parsed && (parsed.id === commandId || parsed.id === 'legacy')) {
                                await fs.unlink(outFile);
                                clearInterval(interval);
                                if (parsed.status === 'SUCCESS') {
                                    resolve(parsed.result ? (typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result)) : 'SUCCESS');
                                } else {
                                    reject(new Error(parsed.error || parsed.status || 'Command failed'));
                                }
                            } else if (parsed && parsed.id) {
                                // Stale response from a previous timed-out command! Clean it up and wait for current
                                await fs.unlink(outFile);
                            }
                        }
                    } catch (err: any) {
                        if (err.code !== 'ENOENT') {
                            clearInterval(interval);
                            reject(err);
                        }
                    }
                }, 50);
            });
        };

        const resultPromise = this.queue.then(execute).finally(() => {
            this.pendingCount = Math.max(0, this.pendingCount - 1);
        });
        this.queue = resultPromise.catch(() => {});
        return resultPromise;
    }
}

