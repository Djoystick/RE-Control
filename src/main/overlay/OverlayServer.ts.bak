import { WebSocketServer, WebSocket } from 'ws';
import { sysLogger } from '../utils/logger';

export class OverlayServer {
    private wss: WebSocketServer | null = null;
    private port: number = 27016;
    private clients: Set<WebSocket> = new Set();

    constructor() {
        try {
            this.wss = new WebSocketServer({ port: this.port });
            this.wss.on('connection', (ws: WebSocket) => {
                this.clients.add(ws);
                ws.on('close', () => {
                    this.clients.delete(ws);
                });
            });
            sysLogger.info(`OverlayServer started on ws://localhost:${this.port}`);
        } catch (error) {
            sysLogger.error('Failed to start OverlayServer', error);
        }
    }

    public broadcast(type: string, data: any) {
        if (!this.wss) return;
        const payload = JSON.stringify({ type, data });
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }
}
