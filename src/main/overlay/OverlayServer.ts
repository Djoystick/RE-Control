import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import QRCode from 'qrcode';
import { sysLogger } from '../utils/logger';
import { EFFECTS_REGISTRY, type RemoteSection } from '../../shared/effects-registry';
import { getProfileEffects, type GameProfileId } from '../../shared/game-profiles';

export function getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    const candidates: string[] = [];

    for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('tailscale') || lowerName.includes('virtual') || lowerName.includes('bluetooth') || lowerName.includes('veth') || lowerName.includes('wsl')) {
            continue;
        }
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
                if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(iface.address)) {
                    return iface.address;
                }
                candidates.push(iface.address);
            }
        }
    }
    if (candidates.length > 0) return candidates[0];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
                return iface.address;
            }
        }
    }

    return '127.0.0.1';
}

export class OverlayServer extends EventEmitter {
    private httpServer: http.Server | null = null;
    private wss: WebSocketServer | null = null;
    private port: number = 27016;
    private clients: Set<WebSocket> = new Set();
    private authToken: string = crypto.randomBytes(16).toString('hex');
    /** Игровой профиль: фильтрует плитки Web Remote (v1.6.0) */
    private gameProfile: GameProfileId = 're2';
    private triggerRateMap: Map<string, { count: number; resetAt: number }> = new Map();
    public static readonly MAX_BODY_BYTES = 64 * 1024; // 64 KB
    public static readonly MAX_WS_CLIENTS = 16;

    constructor() {
        super();
        this.initServer();
    }

    public getAuthToken(): string {
        return this.authToken;
    }

    private isAuthorized(req: http.IncomingMessage, parsedUrl: URL): boolean {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            if (token === this.authToken) return true;
        }
        const queryToken = parsedUrl.searchParams.get('token');
        if (queryToken && queryToken === this.authToken) {
            return true;
        }
        return false;
    }

    private readJsonBody(req: http.IncomingMessage, res: http.ServerResponse, maxBytes: number = OverlayServer.MAX_BODY_BYTES): Promise<any | null> {
        return new Promise((resolve) => {
            let body = '';
            let bytesReceived = 0;
            let tooLarge = false;

            req.on('data', chunk => {
                if (tooLarge) return;
                bytesReceived += chunk.length;
                if (bytesReceived > maxBytes) {
                    tooLarge = true;
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Payload Too Large: Maximum 64KB allowed' }));
                    req.destroy();
                    resolve(null);
                    return;
                }
                body += chunk;
            });

            req.on('end', () => {
                if (tooLarge) return;
                try {
                    const data = JSON.parse(body || '{}');
                    resolve(data);
                } catch (err: any) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON body: ' + err.message }));
                    resolve(null);
                }
            });

            req.on('error', (err) => {
                if (!tooLarge && !res.headersSent) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
                resolve(null);
            });
        });
    }

    private isRateLimited(key: string, limit: number = 10, windowMs: number = 1000): boolean {
        const now = Date.now();
        const entry = this.triggerRateMap.get(key);
        if (!entry || now > entry.resetAt) {
            this.triggerRateMap.set(key, { count: 1, resetAt: now + windowMs });
            return false;
        }
        if (entry.count >= limit) {
            return true;
        }
        entry.count++;
        return false;
    }

    private initServer() {
        try {
            this.httpServer = http.createServer(async (req, res) => {
                sysLogger.info(`[HTTP] ${req.method} ${req.url} (Host: ${req.headers.host || 'none'}) from ${req.socket?.remoteAddress}`);
                try {
                    // Safe CORS: Only reflect local / LAN origin
                    const origin = req.headers.origin;
                    if (origin) {
                        const isLocalOrigin = origin.startsWith('http://localhost') || 
                                              origin.startsWith('http://127.0.0.1') || 
                                              origin.startsWith(`http://${getLocalIp()}`);
                        if (isLocalOrigin) {
                            res.setHeader('Access-Control-Allow-Origin', origin);
                            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                        }
                    }

                    if (req.method === 'OPTIONS') {
                        res.writeHead(204);
                        res.end();
                        return;
                    }

                    const rawUrl = req.url || '/';
                    const hostHeader = req.headers.host || 'localhost';
                    let parsedUrl: URL;
                    try {
                        parsedUrl = new URL(rawUrl, `http://${hostHeader}`);
                    } catch {
                        parsedUrl = new URL('/', `http://${hostHeader}`);
                    }
                    const pathname = (parsedUrl.pathname || '/').replace(/\/+$/, '') || '/';

                    // API: Status
                    if (pathname === '/api/status' && req.method === 'GET') {
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({
                            online: true,
                            clients: this.clients.size,
                            localIp: getLocalIp(),
                            port: this.port
                        }));
                        return;
                    }

                    // API: QR Code data URL (encodes token in URL)
                    if (pathname === '/api/qr' && req.method === 'GET') {
                        try {
                            const targetUrl = this.getLocalUrl();
                            const qrDataUrl = await QRCode.toDataURL(targetUrl, {
                                margin: 1,
                                width: 256,
                                color: { dark: '#00ffff', light: '#0d1117' }
                            });
                            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ url: targetUrl, qr: qrDataUrl }));
                        } catch (e: any) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: e.message }));
                        }
                        return;
                    }

                    // API: Trigger effect directly from mobile phone (Requires Token Auth & Rate Limit)
                    if (pathname === '/api/trigger' && req.method === 'POST') {
                        if (!this.isAuthorized(req, parsedUrl)) {
                            sysLogger.warn(`[OverlayServer] Unauthorized trigger attempt from ${req.socket?.remoteAddress}`);
                            res.writeHead(401, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing token' }));
                            return;
                        }

                        const clientIp = req.socket?.remoteAddress || 'unknown';
                        if (this.isRateLimited(clientIp, 10, 1000)) {
                            sysLogger.warn(`[OverlayServer] Rate limit exceeded for ${clientIp} on /api/trigger`);
                            res.writeHead(429, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Too Many Requests: Rate limit exceeded (10 req/s)' }));
                            return;
                        }

                        const data = await this.readJsonBody(req, res);
                        if (!data) return;

                        const effectId = data.effectId;
                        if (!effectId) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'effectId is required' }));
                            return;
                        }
                        sysLogger.info(`[WebRemote] Triggering effect: ${effectId}`);
                        this.emit('effect:trigger', effectId);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, effectId }));
                        return;
                    }

                    // API: Vote actions (Start / Stop / Intervention) (Requires Token Auth)
                    if (pathname === '/api/vote' && req.method === 'POST') {
                        if (!this.isAuthorized(req, parsedUrl)) {
                            sysLogger.warn(`[OverlayServer] Unauthorized vote attempt from ${req.socket?.remoteAddress}`);
                            res.writeHead(401, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing token' }));
                            return;
                        }

                        const data = await this.readJsonBody(req, res);
                        if (!data) return;

                        const action = data.action;
                        sysLogger.info(`[WebRemote] Vote action: ${action}`);
                        this.emit('vote:action', action);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, action }));
                        return;
                    }

                    // Web Remote Mobile HTML page (supports /remote, /remote/, /)
                    if (pathname === '/remote' || pathname === '/') {
                        if (!this.isAuthorized(req, parsedUrl)) {
                            res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end(`<!DOCTYPE html><html><body style="background:#0a0c10;color:#ef4444;font-family:sans-serif;text-align:center;padding:50px;"><h2>Доступ запрещен (401 Unauthorized)</h2><p style="color:#94a3b8;">Для доступа к пульту Stream Deck отсканируйте актуальный QR-код в приложении RE:Control на ПК.</p></body></html>`);
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(this.getMobileRemoteHtml(this.authToken));
                        return;
                    }

                    // OBS Studio Overlay (supports /overlay and /overlay.html)
                    if (pathname === '/overlay' || pathname === '/overlay.html') {
                        if (process.env['ELECTRON_RENDERER_URL']) {
                            res.writeHead(302, { 'Location': `${process.env['ELECTRON_RENDERER_URL']}/overlay.html` });
                            res.end();
                            return;
                        }

                        const possibleOverlayPaths = [
                            path.resolve(__dirname, '../renderer/overlay.html'),
                            path.resolve(__dirname, '../../out/renderer/overlay.html'),
                            path.resolve(__dirname, '../../../out/renderer/overlay.html'),
                            path.resolve(process.cwd(), 'out/renderer/overlay.html')
                        ];
                        const overlayPath = possibleOverlayPaths.find(p => fs.existsSync(p));
                        if (overlayPath) {
                            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end(fs.readFileSync(overlayPath));
                            return;
                        }
                        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                        res.end('Overlay build not found. Run npm run build.');
                        return;
                    }

                    // Static assets for overlay (/assets/*)
                    if (pathname && pathname.startsWith('/assets/')) {
                        const possibleAssetBases = [
                            path.resolve(__dirname, '../renderer/assets'),
                            path.resolve(__dirname, '../../out/renderer/assets'),
                            path.resolve(__dirname, '../../../out/renderer/assets'),
                            path.resolve(process.cwd(), 'out/renderer/assets')
                        ];
                        const assetsBase = possibleAssetBases.find(p => fs.existsSync(p));
                        if (assetsBase) {
                            const assetRel = pathname.replace(/^\/assets\//, '');
                            const assetPath = path.resolve(assetsBase, assetRel);
                            if (assetPath.startsWith(assetsBase) && fs.existsSync(assetPath)) {
                                const ext = path.extname(assetPath).toLowerCase();
                                const mimeTypes: Record<string, string> = {
                                    '.js': 'text/javascript; charset=utf-8',
                                    '.css': 'text/css; charset=utf-8',
                                    '.json': 'application/json; charset=utf-8',
                                    '.png': 'image/png',
                                    '.jpg': 'image/jpeg',
                                    '.svg': 'image/svg+xml',
                                    '.ico': 'image/x-icon',
                                    '.woff': 'font/woff',
                                    '.woff2': 'font/woff2'
                                };
                                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                                res.end(fs.readFileSync(assetPath));
                                return;
                            }
                        }
                    }

                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                } catch (requestErr: any) {
                    sysLogger.error(`[OverlayServer] Request handling error:`, requestErr);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                    }
                    res.end('Internal Server Error');
                }
            });

            this.httpServer.on('clientError', (err: any, socket: any) => {
                sysLogger.warn(`[OverlayServer] Client error from ${socket?.remoteAddress}: ${err.message}`);
                if (socket.writable) {
                    socket.end(`HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<!DOCTYPE html><html><body style="background:#0a0c10;color:#00ffff;font-family:sans-serif;text-align:center;padding:50px;"><h2>RE:Control Stream Deck</h2><p>Пожалуйста, открывайте через <b>HTTP</b>, а не HTTPS:</p><p><a href="http://${getLocalIp()}:${this.port}/remote" style="color:#00ffff;font-size:18px;">http://${getLocalIp()}:${this.port}/remote</a></p></body></html>`);
                }
            });

            // WebSocket Server attaches to the same HTTP server
            this.wss = new WebSocketServer({ server: this.httpServer });

            const interval = setInterval(() => {
                for (const client of this.clients) {
                    const extClient = client as any;
                    if (extClient.isAlive === false) {
                        this.clients.delete(client);
                        this.emit('clients:update', this.clients.size);
                        client.terminate();
                        continue;
                    }
                    extClient.isAlive = false;
                    client.ping();
                }
            }, 30000);

            this.wss.on('close', () => {
                clearInterval(interval);
            });

            this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
                if (this.clients.size >= OverlayServer.MAX_WS_CLIENTS) {
                    sysLogger.warn(`[OverlayServer] WS connection rejected: max ${OverlayServer.MAX_WS_CLIENTS} clients reached`);
                    ws.close(4008, 'Max clients reached');
                    return;
                }

                const remoteAddr = req.socket?.remoteAddress || '';
                const isLocal = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';

                if (!isLocal) {
                    let token = '';
                    try {
                        const host = req.headers.host || 'localhost';
                        const parsedUrl = new URL(req.url || '/', `http://${host}`);
                        token = parsedUrl.searchParams.get('token') || '';
                    } catch {}

                    if (token !== this.authToken) {
                        sysLogger.warn(`[OverlayServer] WS unauthorized connection attempt from ${remoteAddr}`);
                        ws.close(4001, 'Unauthorized');
                        return;
                    }
                }

                const extWs = ws as any;
                extWs.isAlive = true;
                ws.on('pong', () => {
                    extWs.isAlive = true;
                });
                this.clients.add(ws);
                this.emit('clients:update', this.clients.size);
                ws.on('close', () => {
                    this.clients.delete(ws);
                    this.emit('clients:update', this.clients.size);
                });
            });

            this.httpServer.on('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    sysLogger.warn(`[OverlayServer] Port ${this.port} is already in use. Will retry in 2s...`);
                    setTimeout(() => {
                        try {
                            this.httpServer?.listen(this.port, '0.0.0.0');
                        } catch (e) {
                            sysLogger.error('[OverlayServer] Retry listen error', e);
                        }
                    }, 2000);
                } else {
                    sysLogger.error('[OverlayServer] HTTP Server error', err);
                }
            });

            // Listen on 0.0.0.0 so both PC and LAN devices (phones) can connect
            this.httpServer.listen(this.port, '0.0.0.0', () => {
                const localIp = getLocalIp();
                sysLogger.info(`[OverlayServer] HTTP & WebSocket running on http://0.0.0.0:${this.port}`);
                sysLogger.info(`[WebRemote] Mobile Stream Deck: http://${localIp}:${this.port}/remote`);
            });

        } catch (error) {
            sysLogger.error('Failed to start OverlayServer', error);
        }
    }

    public stop() {
        if (this.wss) {
            try {
                this.wss.close();
            } catch (e) {
                sysLogger.warn('[OverlayServer] Error closing WebSocket server: ' + e);
            }
        }
        if (this.httpServer) {
            try {
                this.httpServer.close();
            } catch (e) {
                sysLogger.warn('[OverlayServer] Error closing HTTP server: ' + e);
            }
        }
    }

    public getClientCount(): number {
        return this.clients.size;
    }

    /** Профиль игры для фильтрации плиток пульта (v1.6.0) */
    public setGameProfile(profileId: GameProfileId): void {
        this.gameProfile = profileId;
        sysLogger.info(`[OverlayServer] Game profile for Web Remote: ${profileId}`);
    }

    public getLocalUrl(): string {
        return `http://${getLocalIp()}:${this.port}/remote?token=${this.authToken}`;
    }

    public getOverlayUrl(): string {
        return `http://localhost:${this.port}/overlay?token=${this.authToken}`;
    }

    public async getQrCode(): Promise<string> {
        return QRCode.toDataURL(this.getLocalUrl(), {
            margin: 1,
            width: 256,
            color: { dark: '#00ffff', light: '#090d16' }
        });
    }

    public broadcast(type: string, data: any) {
        if (!this.wss) return;
        const payload = JSON.stringify({ type, data });
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                if (client.bufferedAmount > 64 * 1024) {
                    sysLogger.warn(`[OverlayServer] WS client buffer overflow (${client.bufferedAmount} bytes). Dropping frame.`);
                    continue;
                }
                client.send(payload);
            }
        }
    }

    /** Renders the effect card sections of the Web Remote from the shared registry */
    private renderRemoteSections(): string {
        const allowed = new Set(getProfileEffects(this.gameProfile).map(e => e.id));
        const sections: { key: RemoteSection; title: string; css: string }[] = [
            { key: 'negative', title: '⚡ ВРЕДИТЕЛЬСТВО (ОТРИЦАТЕЛЬНЫЕ)', css: 'red' },
            { key: 'positive', title: '💚 ПОМОЩЬ (ПОЛОЖИТЕЛЬНЫЕ)', css: 'green' },
            { key: 'umbrella', title: '🧟 АМБРЕЛЛА И СПАВН', css: 'purple' }
        ];

        return sections.map(section => {
            const cards = EFFECTS_REGISTRY
                .filter(e => e.remoteSection === section.key && allowed.has(e.id))
                .map(e => {
                    const title = e.name.split(' (')[0];
                    const sub = e.description;
                    const escapedName = e.name.replace(/'/g, "\\'");
                    return `        <div class="card ${section.css}" onclick="triggerEffect('${e.id}', this, '${escapedName}')">
            <div class="card-top"><span class="card-icon">${e.icon || '▸'}</span></div>
            <div class="card-title">${title}</div>
            <div class="card-sub">${sub}</div>
        </div>`;
                }).join('\n');

            return `    <div class="section-title ${section.css}">${section.title}</div>
    <div class="grid">
${cards}
    </div>`;
        }).join('\n\n');
    }

    private getMobileRemoteHtml(token: string): string {
        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>RE:Control — Web Remote</title>
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="theme-color" content="#0a0c10">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body {
            background-color: #07090e;
            color: #f1f5f9;
            font-family: 'JetBrains Mono', monospace;
            padding: 12px;
            padding-bottom: 80px;
            user-select: none;
            -webkit-user-select: none;
        }
        header {
            position: sticky;
            top: 0;
            background: rgba(7, 9, 14, 0.95);
            backdrop-filter: blur(10px);
            z-index: 100;
            padding-bottom: 8px;
            border-bottom: 1px solid #1e293b;
            margin-bottom: 12px;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .title {
            font-family: 'Chakra Petch', sans-serif;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 1px;
            color: #38bdf8;
            text-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
        }
        .badge {
            font-size: 10px;
            padding: 3px 8px;
            border-radius: 9999px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 5px;
            background: rgba(34, 197, 94, 0.15);
            color: #4ade80;
            border: 1px solid rgba(74, 222, 128, 0.3);
        }
        .pulse {
            width: 6px;
            height: 6px;
            background: #4ade80;
            border-radius: 50%;
            box-shadow: 0 0 8px #4ade80;
            animation: pulse-anim 1.5s infinite;
        }
        @keyframes pulse-anim { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        
        .quick-bar {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 8px;
        }
        .quick-btn {
            background: #111827;
            border: 1px solid #374151;
            color: #f3f4f6;
            padding: 8px;
            border-radius: 6px;
            font-family: 'Chakra Petch', sans-serif;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .quick-btn.danger {
            background: rgba(220, 38, 38, 0.15);
            border-color: rgba(239, 68, 68, 0.4);
            color: #f87171;
        }
        .quick-btn.amber {
            background: rgba(245, 158, 11, 0.15);
            border-color: rgba(245, 158, 11, 0.4);
            color: #fbbf24;
        }

        .section-title {
            font-family: 'Chakra Petch', sans-serif;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin: 14px 0 8px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .section-title.red { color: #f87171; }
        .section-title.green { color: #4ade80; }
        .section-title.purple { color: #c084fc; }

        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        .card {
            background: #0d121d;
            border: 1px solid #1f293d;
            border-radius: 8px;
            padding: 12px 10px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 72px;
            position: relative;
            overflow: hidden;
            transition: transform 0.1s, border-color 0.15s, background-color 0.15s;
        }
        .card:active {
            transform: scale(0.96);
        }
        .card.active-flash {
            border-color: #38bdf8 !important;
            background: rgba(56, 189, 248, 0.25) !important;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
        }
        .card-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .card-icon {
            font-size: 20px;
        }
        .card-title {
            font-family: 'Chakra Petch', sans-serif;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.2;
            margin-top: 4px;
        }
        .card-sub {
            font-size: 9px;
            color: #94a3b8;
            margin-top: 2px;
        }

        /* Category Accents */
        .card.red { border-color: rgba(239, 68, 68, 0.25); }
        .card.red .card-title { color: #fca5a5; }
        .card.red:active { background: rgba(239, 68, 68, 0.2); }

        .card.green { border-color: rgba(34, 197, 94, 0.25); }
        .card.green .card-title { color: #86efac; }
        .card.green:active { background: rgba(34, 197, 94, 0.2); }

        .card.purple { border-color: rgba(168, 85, 247, 0.25); }
        .card.purple .card-title { color: #d8b4fe; }
        .card.purple:active { background: rgba(168, 85, 247, 0.2); }

        /* Floating Toast Notification */
        #toast {
            position: fixed;
            bottom: 15px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: #1e293b;
            border: 1px solid #38bdf8;
            color: #f8fafc;
            padding: 10px 18px;
            border-radius: 30px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7), 0 0 15px rgba(56, 189, 248, 0.3);
            transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            pointer-events: none;
            white-space: nowrap;
        }
        #toast.show {
            transform: translateX(-50%) translateY(0);
        }
    </style>
</head>
<body>
    <header>
        <div class="header-top">
            <div class="title">RE:CONTROL STREAM DECK</div>
            <div class="badge"><div class="pulse"></div> RE ENGINE</div>
        </div>
        <div class="quick-bar">
            <button class="quick-btn amber" onclick="sendVoteAction('start')">🗳️ СТАРТ ГОЛОСОВАНИЯ</button>
            <button class="quick-btn danger" onclick="sendVoteAction('intervention')">🛑 ВМЕШАТЕЛЬСТВО</button>
        </div>
    </header>

    ${this.renderRemoteSections()}
    <div id="toast">✅ Эффект отправлен!</div>

    <script>
        const AUTH_TOKEN = ${JSON.stringify(token)};
        let toastTimeout = null;

        function showToast(msg) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.classList.add('show');
            if (toastTimeout) clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                t.classList.remove('show');
            }, 1800);
        }

        async function triggerEffect(effectId, cardEl, title) {
            if ('vibrate' in navigator) navigator.vibrate(40);
            if (cardEl) {
                cardEl.classList.add('active-flash');
                setTimeout(() => cardEl.classList.remove('active-flash'), 400);
            }

            try {
                const res = await fetch('/api/trigger', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + AUTH_TOKEN
                    },
                    body: JSON.stringify({ effectId })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('🎮 ' + title + ' — применен!');
                } else {
                    showToast('⚠️ Ошибка: ' + (data.error || 'Сбой'));
                }
            } catch (e) {
                showToast('❌ Ошибка связи с ПК');
            }
        }

        async function sendVoteAction(action) {
            if ('vibrate' in navigator) navigator.vibrate(60);
            try {
                const res = await fetch('/api/vote', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + AUTH_TOKEN
                    },
                    body: JSON.stringify({ action })
                });
                showToast('🚀 Действие [' + action + '] выполнено!');
            } catch (e) {
                showToast('❌ Ошибка связи');
            }
        }
    </script>
</body>
</html>`;
    }
}
