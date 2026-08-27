export interface ChatCommand {
    username: string;
    command: string;
    args: string[];
    isTrusted?: boolean;
}

export interface IChatBridge {
    connect(channelOrConfig?: string): Promise<void>;
    disconnect(): void;
    onCommand(callback: (cmd: ChatCommand) => void): void;
    sendMessage(channel: string, message: string): void;
}
