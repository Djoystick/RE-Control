import { describe, it, expect } from 'vitest';
import { LINE_REGISTRY, pickLine, getNarratorEvents } from '../LineRegistry';

describe('LineRegistry', () => {
    it('exposes every legacy event the Narrator used before v1.4.1', () => {
        const legacy = ['veto', 'invert', 'blind', 'equalize', 'turbo', 'traitor', 'negative_win', 'positive_win'];
        for (const event of legacy) {
            expect(getNarratorEvents()).toContain(event);
        }
    });

    it('every line has at least one non-empty variant', () => {
        for (const [event, line] of Object.entries(LINE_REGISTRY)) {
            expect(line.variants.length, `${event} needs variants`).toBeGreaterThan(0);
            for (const text of line.variants) {
                expect(text.trim().length, `${event} has an empty variant`).toBeGreaterThan(0);
            }
        }
    });

    it('keeps actor file prefixes backward compatible', () => {
        // The actor recordings are prefixed neg_/pos_ — this mapping must not drift
        expect(LINE_REGISTRY.negative_win.filePrefix).toBe('neg');
        expect(LINE_REGISTRY.positive_win.filePrefix).toBe('pos');
        // Intervention lines use the event id as the prefix
        expect(pickLine('veto')!.prefix).toBe('veto');
    });

    it('routes presets to the right voice folders', () => {
        expect(LINE_REGISTRY.positive_win.preset).toBe('ally_radio');
        expect(LINE_REGISTRY.negative_win.preset).toBe('umbrella_hq');
        expect(LINE_REGISTRY.traitor.preset).toBe('traitor');
    });

    it('pickLine returns a variant from the registry', () => {
        const picked = pickLine('veto');
        expect(picked).not.toBeNull();
        expect(LINE_REGISTRY.veto.variants).toContain(picked!.text);
        expect(picked!.preset).toBe('umbrella_hq');
    });

    it('returns null for unknown events', () => {
        expect(pickLine('does_not_exist')).toBeNull();
    });

    it('covers the new v1.3/v1.4 events', () => {
        for (const event of ['director_mercy', 'director_pulse', 'mega_unlock', 'shield_saved', 'panic']) {
            expect(pickLine(event), `${event} should have a line`).not.toBeNull();
        }
    });
});