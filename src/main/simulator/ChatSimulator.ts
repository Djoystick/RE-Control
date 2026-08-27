import { IChatBridge, ChatCommand } from '../chat-bridge/IChatBridge';

export class ChatSimulator implements IChatBridge {
    private commandCallback: ((cmd: ChatCommand) => void) | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;

    async connect(_channelOrConfig?: string): Promise<void> {
        // No real connection needed for simulator
    }

    disconnect(): void {
        this.stopSimulating();
    }

    onCommand(callback: (cmd: ChatCommand) => void): void {
        this.commandCallback = callback;
    }

    startSimulating(intervalMs: number): void {
        this.stopSimulating();
        // Simulate random viewers typing '1', '2', or '3' to vote
        this.timer = setInterval(() => {
            if (this.commandCallback) {
                const randomViewer = 'Bot_' + Math.floor(Math.random() * 10000);
                const vote = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
                this.commandCallback({
                    username: randomViewer,
                    command: vote.toString(),
                    args: []
                });
            }
        }, intervalMs);
    }

    stopSimulating(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    sendMessage(channel: string, message: string): void {
        console.log(`[SIMULATOR CHAT] ${channel}: ${message}`);
    }
}
