import { app, safeStorage, shell } from 'electron'
import fs from 'fs'
import { join } from 'path'
import { sysLogger } from '../utils/logger'

/**
 * Twitch OAuth Device Code Flow (RFC 8628).
 *
 * Стримеру не нужно вставлять токен руками: приложение показывает короткий
 * код, стример вводит его на twitch.tv/activate и подтверждает доступ.
 * Токен после этого шифруется через Windows DPAPI и больше не показывается.
 *
 * Требуется public client id приложения Twitch (без секрета) — device flow
 * не использует client secret.
 */

const DEVICE_URL = 'https://id.twitch.tv/oauth2/device'
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate'
const SCOPES = 'chat:read chat:edit'

export interface DeviceFlowStart {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
}

export interface DeviceFlowResult {
    success: boolean;
    username?: string;
    error?: string;
    /** Код всё ещё ожидает подтверждения — опрос нужно продолжить */
    pending?: boolean;
}

export interface StoredAuth {
    username: string;
    token: string;
}

export class DeviceCodeAuth {
    private clientId: string = '';

    private getConfigPath(): string {
        return join(app.getPath('userData'), 'twitch_config.json');
    }

    /** Client ID берём из переменной окружения или конфига (публичный, не секрет) */
    setClientId(clientId: string) {
        this.clientId = clientId.trim();
    }

    getClientId(): string {
        return this.clientId;
    }

    isConfigured(): boolean {
        return this.clientId.length > 0;
    }

    async start(): Promise<DeviceFlowStart | { error: string }> {
        if (!this.isConfigured()) {
            return { error: 'Не задан Twitch Client ID приложения. Device-авторизация недоступна.' }
        }
        try {
            const body = new URLSearchParams({ client_id: this.clientId, scopes: SCOPES });
            const res = await fetch(DEVICE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                return { error: `Twitch отказал в device-коде (${res.status}): ${text.slice(0, 120)}` };
            }
            const data = await res.json() as any;
            return {
                deviceCode: data.device_code,
                userCode: data.user_code,
                verificationUri: data.verification_uri,
                expiresIn: data.expires_in ?? 1800,
                interval: data.interval ?? 5
            };
        } catch (err: any) {
            return { error: `Сеть недоступна: ${err.message}` };
        }
    }

    /** Один шаг опроса: pending = пользователь ещё не подтвердил */
    async poll(deviceCode: string): Promise<DeviceFlowResult> {
        try {
            const body = new URLSearchParams({
                client_id: this.clientId,
                scopes: SCOPES,
                device_code: deviceCode,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            });
            const res = await fetch(TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            const data = await res.json().catch(() => ({})) as any;

            if (res.ok && data.access_token) {
                const username = await this.resolveUsername(data.access_token);
                this.storeToken(username, data.access_token);
                sysLogger.info(`[DeviceAuth] Authorized as ${username}`);
                return { success: true, username };
            }

            // authorization_pending — нормальный ход событий
            if (data.message === 'authorization_pending' || data.status === 400 && /pending/i.test(data.message || '')) {
                return { success: false, pending: true };
            }
            if (data.message === 'expired_token') {
                return { success: false, error: 'Код истёк. Запросите новый.' };
            }
            if (data.message === 'access_denied') {
                return { success: false, error: 'Доступ отклонён на Twitch.' };
            }
            return { success: false, error: data.message || `HTTP ${res.status}` };
        } catch (err: any) {
            return { success: false, error: `Сеть недоступна: ${err.message}` };
        }
    }

    private async resolveUsername(token: string): Promise<string> {
        try {
            const res = await fetch(VALIDATE_URL, { headers: { Authorization: `OAuth ${token}` } });
            if (res.ok) {
                const data = await res.json() as any;
                if (data.login) return data.login;
            }
        } catch { /* fall through */ }
        return 'umbrella_bot';
    }

    /** Токен сохраняется в twitch_config.json с DPAPI-шифрованием */
    private storeToken(username: string, token: string) {
        const configPath = this.getConfigPath();
        let existing: any = {};
        try {
            if (fs.existsSync(configPath)) existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch { /* ignore */ }

        const payload: any = { ...existing, username };
        if (safeStorage.isEncryptionAvailable()) {
            payload.encryptedToken = safeStorage.encryptString(token).toString('base64');
            payload.isEncrypted = true;
            delete payload.token;
        } else {
            payload.token = token;
            payload.isEncrypted = false;
        }
        fs.writeFileSync(configPath, JSON.stringify(payload, null, 2));
    }

    /** Открывает страницу подтверждения в системном браузере */
    openVerificationPage(uri: string) {
        shell.openExternal(uri).catch((err) => {
            sysLogger.warn(`[DeviceAuth] Failed to open browser: ${err.message}`);
        });
    }

    /** Удаляет сохранённый токен (выход из бот-режима) */
    clearToken() {
        const configPath = this.getConfigPath();
        try {
            if (!fs.existsSync(configPath)) return;
            const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            delete raw.token;
            delete raw.encryptedToken;
            delete raw.isEncrypted;
            delete raw.username;
            fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
            sysLogger.info('[DeviceAuth] Stored token cleared');
        } catch (err: any) {
            sysLogger.warn(`[DeviceAuth] Failed to clear token: ${err.message}`);
        }
    }
}

export const deviceCodeAuth = new DeviceCodeAuth();