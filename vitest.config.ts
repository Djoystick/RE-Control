import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/__tests__/**/*.test.ts'],
        globals: true,
        fakeTimers: {
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
        }
    }
});