import { describe, it, expect, vi, beforeEach } from 'vitest';

// Electron mocks: safeStorage is used by DeviceCodeAuth persistence
vi.mock('electron', () => ({
    app: { getPath: vi.fn(() => '/tmp/re-control-test') },
    safeStorage: {
        isEncryptionAvailable: vi.fn(() => false),
        encryptString: vi.fn(),
        decryptString: vi.fn()
    },
    shell: { openExternal: vi.fn(async () => {}) }
}));

import * as fs from 'fs';
import * as path from 'path';
import { DeviceCodeAuth } from '../DeviceCodeAuth';

const CONFIG_PATH = path.join('/tmp/re-control-test', 'twitch_config.json');

function cleanup() {
    try { if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH); } catch {}
    try { fs.rmSync('/tmp/re-control-test', { recursive: true, force: true }); } catch {}
}

describe('DeviceCodeAuth', () => {
    beforeEach(() => {
        cleanup();
        try { fs.mkdirSync('/tmp/re-control-test', { recursive: true }); } catch {}
    });

    it('refuses to start without a client id', async () => {
        const auth = new DeviceCodeAuth();
        const result = await auth.start();
        expect('error' in result).toBe(true);
        expect((result as any).error).toContain('Client ID');
    });

    it('reports device flow as unavailable without a client id', () => {
        const auth = new DeviceCodeAuth();
        expect(auth.isConfigured()).toBe(false);
    });

    it('start() requests device code with chat scopes', async () => {
        const auth = new DeviceCodeAuth();
        auth.setClientId('test_client_id');

        const fetchMock = vi.fn(async (_url: string, _init?: any) => ({
            ok: true,
            json: async () => ({
                device_code: 'dev123',
                user_code: 'ABCD-1234',
                verification_uri: 'https://www.twitch.tv/activate',
                expires_in: 1800,
                interval: 5
            })
        }));
        global.fetch = fetchMock as any;

        const result = await auth.start();
        expect('deviceCode' in result).toBe(true);
        const call = fetchMock.mock.calls[0];
        expect(call[0]).toBe('https://id.twitch.tv/oauth2/device');
        expect(String(call[1].body)).toContain('chat%3Aread');
        expect(String(call[1].body)).toContain('chat%3Aedit');
    });

    it('poll() keeps pending while the user has not confirmed', async () => {
        const auth = new DeviceCodeAuth();
        auth.setClientId('test_client_id');

        global.fetch = vi.fn(async () => ({
            ok: false,
            json: async () => ({ status: 400, message: 'authorization_pending' })
        })) as any;

        const result = await auth.poll('dev123');
        expect(result.pending).toBe(true);
        expect(result.success).toBe(false);
        expect(result.error).toBeUndefined();
    });

    it('poll() reports access denied', async () => {
        const auth = new DeviceCodeAuth();
        auth.setClientId('test_client_id');

        global.fetch = vi.fn(async () => ({
            ok: false,
            json: async () => ({ message: 'access_denied' })
        })) as any;

        const result = await auth.poll('dev123');
        expect(result.pending).toBeUndefined();
        expect(result.error).toContain('отклонён');
    });

    it('poll() stores the token on success', async () => {
        const auth = new DeviceCodeAuth();
        auth.setClientId('test_client_id');

        let calls = 0;
        global.fetch = vi.fn(async (url: string) => {
            calls++;
            if (String(url).includes('/token')) {
                return { ok: true, json: async () => ({ access_token: 'tok_abc' }) };
            }
            // validate endpoint
            return { ok: true, json: async () => ({ login: 'my_bot' }) };
        }) as any;

        const result = await auth.poll('dev123');
        expect(result.success).toBe(true);
        expect(result.username).toBe('my_bot');

        const stored = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        expect(stored.username).toBe('my_bot');
        expect(stored.token).toBe('tok_abc');
        expect(stored.isEncrypted).toBe(false);
    });

    it('clearToken() wipes credentials but keeps other config', async () => {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ username: 'bot', token: 'tok', channel: 'hyver' }));
        const auth = new DeviceCodeAuth();
        auth.clearToken();

        const stored = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        expect(stored.token).toBeUndefined();
        expect(stored.username).toBeUndefined();
        expect(stored.channel).toBe('hyver');
    });

    it('openVerificationPage() delegates to the system browser', async () => {
        const { shell } = await import('electron');
        const auth = new DeviceCodeAuth();
        auth.openVerificationPage('https://twitch.tv/activate');
        expect(shell.openExternal).toHaveBeenCalledWith('https://twitch.tv/activate');
    });
});