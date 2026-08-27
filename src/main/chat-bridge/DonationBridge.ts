import { EventEmitter } from 'events';

export class DonationBridge extends EventEmitter {
    constructor() {
        super();
    }

    simulateDonation(username: string, amount: number, currency: string, message: string) {
        this.emit('donation:received', { username, amount, currency, message });
    }
}
