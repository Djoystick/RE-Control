import * as tmi from 'tmi.js';
import { IChatBridge, ChatCommand } from './IChatBridge';
import { app, safeStorage } from 'electron';
import fs from 'fs';
import { join } from 'path';

export class TwitchBridge implements IChatBridge {
    private client: tmi.Client | null = null;
    public isBotAuthenticated: boolean = false;
    private commandCallback: ((cmd: ChatCommand) => void) | null = null;

    async connect(channel: string): Promise<void> {
        this.disconnect();
        
        const configPath = join(app.getPath('userData'), 'twitch_config.json');
        let identity: any = undefined;
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                let token = '';
                if (config.isEncrypted && config.encryptedToken && safeStorage.isEncryptionAvailable()) {
                    token = safeStorage.decryptString(Buffer.from(config.encryptedToken, 'base64'));
                } else if (config.token) {
                    token = config.token;
                }

                if (config.username && token) {
                    identity = { username: config.username, password: token };
                    this.isBotAuthenticated = true;
                }
            } catch (e) {
                console.error('Failed to parse twitch config', e);
            }
        }

        this.isBotAuthenticated = !!identity;
        this.client = new tmi.Client({
            identity,
            channels: [channel]
        });

        try {
            await this.client.connect();
        } catch (err) {
            console.error('Failed to connect to Twitch:', err);
            throw err;
        }

        this.client.on('message', (_channel, tags, message, self) => {
            if (self) return;
            if (this.commandCallback) {
                let isTrusted = false;
                if (tags.badges) {
                    if (tags.badges.vip || tags.badges.subscriber || tags.badges.moderator || tags.badges.broadcaster) {
                        isTrusted = true;
                    }
                }

                this.commandCallback({
                    username: tags.username || 'unknown',
                    command: message.trim(),
                    args: [],
                    isTrusted
                });
            }
        });
    }

    disconnect(): void {
        if (this.client) {
            this.client.disconnect().catch(console.error);
            this.client = null;
        }
    }

    onCommand(callback: (cmd: ChatCommand) => void): void {
        this.commandCallback = callback;
    }

    sendMessage(channel: string, message: string): void {
        if (this.client) {
            this.client.say(channel, message).catch(console.error);
        }
    }
}

