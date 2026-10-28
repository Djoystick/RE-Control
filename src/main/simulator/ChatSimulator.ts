import { IChatBridge, ChatCommand } from '../chat-bridge/IChatBridge';

export class ChatSimulator implements IChatBridge {
    private commandCallback: ((cmd: ChatCommand) => void) | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private traitorTimer: ReturnType<typeof setTimeout> | null = null;
    private activeTraitor: string | null = null;

    async connect(_channelOrConfig?: string): Promise<void> {
        // No real connection needed for simulator
    }

    disconnect(): void {
        this.stopSimulating();
    }

    onCommand(callback: (cmd: ChatCommand) => void): void {
        this.commandCallback = callback;
    }

    setTraitor(username: string | null): void {
        this.activeTraitor = username;
        if (this.traitorTimer) {
            clearTimeout(this.traitorTimer);
            this.traitorTimer = null;
        }

        // If a traitor bot is selected in simulation mode, have it pick a choice after 2.5 seconds
        if (username && this.commandCallback) {
            this.traitorTimer = setTimeout(() => {
                if (this.activeTraitor === username && this.commandCallback) {
                    const traitorChoice = Math.floor(Math.random() * 5) + 1; // 1 to 5
                    this.commandCallback({
                        username,
                        command: traitorChoice.toString(),
                        args: [],
                        isTrusted: true
                    });
                }
            }, 2500);
        }
    }

    startSimulating(intervalMs: number): void {
        this.stopSimulating();
        // Simulate a realistic active chat of ~30 viewers, with ~30% having VIP / Sub badges
        this.timer = setInterval(() => {
            if (this.commandCallback) {
                const isTrusted = Math.random() < 0.3;
                const botId = Math.floor(Math.random() * 30) + 1;
                const randomViewer = isTrusted ? `VIP_Viewer_${botId}` : `Viewer_${botId}`;
                // Occasionally a simulated viewer types a bot command instead of a vote
                const isCommand = Math.random() < 0.05;
                const command = isCommand
                    ? (['!karma', '!top', '!effects', '!me'][Math.floor(Math.random() * 4)])
                    : (Math.floor(Math.random() * 3) + 1).toString();
                this.commandCallback({
                    username: randomViewer,
                    command,
                    args: [],
                    isTrusted
                });
            }
        }, intervalMs);
    }

    stopSimulating(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.traitorTimer) {
            clearTimeout(this.traitorTimer);
            this.traitorTimer = null;
        }
        this.activeTraitor = null;
    }

    sendMessage(channel: string, message: string): void {
        console.log(`[SIMULATOR CHAT] ${channel}: ${message}`);
    }
}
