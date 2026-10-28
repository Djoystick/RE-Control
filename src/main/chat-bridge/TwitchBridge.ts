import * as tmi from 'tmi.js';
import { IChatBridge, ChatCommand } from './IChatBridge';
import { app, safeStorage } from 'electron';
import fs from 'fs';
import { join } from 'path';

export class TwitchBridge implements IChatBridge {
    public isMod: boolean = false;
    public botUsername: string = '';
    private statusCallback: ((status: any) => void) | null = null;
    private client: tmi.Client | null = null;
    public isBotAuthenticated: boolean = false;
    /** true = подключение без токена (justinfan): читаем чат, но не пишем */
    public isReadOnly: boolean = true;
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
                // Set botUsername from config
                this.botUsername = config.username || '';
            } catch (e) {
                console.error('Failed to parse twitch config', e);
            }
        }

        this.isBotAuthenticated = !!identity;
        this.isReadOnly = !identity;
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

        // Additional event listeners
        (this.client as any).on('userstate', (_channel: string, userstate: any) => {
            const isModerator = !!(userstate?.mod || userstate?.['user-type'] === 'mod' || userstate?.badges?.moderator);
            this.isMod = isModerator;
            if (this.statusCallback) this.statusCallback(this.getStatus());
        });

        this.client.on('mods', (_channel: string, mods: string[]) => {
            if (this.botUsername && mods.map(m => m.toLowerCase()).includes(this.botUsername.toLowerCase())) {
                this.isMod = true;
                if (this.statusCallback) this.statusCallback(this.getStatus());
            }
        });

        this.client.on('mod', (_channel: string, username: string) => {
            if (this.botUsername && username.toLowerCase() === this.botUsername.toLowerCase()) {
                this.isMod = true;
                if (this.statusCallback) this.statusCallback(this.getStatus());
            }
        });

        this.client.on('unmod', (_channel: string, username: string) => {
            if (this.botUsername && username.toLowerCase() === this.botUsername.toLowerCase()) {
                this.isMod = false;
                if (this.statusCallback) this.statusCallback(this.getStatus());
            }
        });

        this.client.on('notice', (_channel: string, msgid: any, message: string) => {
            console.warn('[Twitch Notice]:', msgid, message);
        });
    }

    disconnect(): void {
        if (this.client) {
            this.client.disconnect().catch(console.error);
            this.client = null;
        }
        // Reset state
        this.isMod = false;
        this.botUsername = '';
        this.isBotAuthenticated = false;
        this.isReadOnly = true;
        if (this.statusCallback) this.statusCallback(this.getStatus());
    }

    onCommand(callback: (cmd: ChatCommand) => void): void {
        this.commandCallback = callback;
    }

    /**
     * Отправка сообщения в чат. В read-only режиме (без токена) сообщение
     * не отправляется — вызывающая сторона должна продублировать его
     * в оверлей через announce().
     */
    sendMessage(channel: string, message: string): boolean {
        if (!this.client || this.isReadOnly) return false;
        this.client.say(channel, message).catch((err) => {
            console.error('[TwitchBridge] say failed:', err);
        });
        return true;
    }

    canWrite(): boolean {
        return !!this.client && !this.isReadOnly && this.isBotAuthenticated;
    }

    onStatusChange(callback: (status: any) => void): void {
        this.statusCallback = callback;
    }

    getStatus() {
        return {
            connected: !!this.client,
            botAuthenticated: this.isBotAuthenticated,
            botUsername: this.botUsername,
            isMod: this.isMod,
            readOnly: this.isReadOnly
        };
    }

    async sendTestPing(channel: string): Promise<{ success: boolean; message?: string; error?: string }> {
        if (!this.client || !this.isBotAuthenticated) {
            return { success: false, error: 'Бот не авторизован (отсутствует токен бота)' };
        }
        try {
            const msg = '☣️ [UMBRELLA CORP] Тестовый протокол связи успешен. Бот авторизован и готов к работе.';
            await this.client.say(channel, msg);
            return { success: true, message: msg };
        } catch (err: any) {
            return { success: false, error: err.message || 'Ошибка отправки тестового сообщения' };
        }
    }
}
