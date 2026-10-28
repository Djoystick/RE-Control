import { describe, it, expect } from 'vitest';
import { EFFECTS_REGISTRY, VOTABLE_EFFECTS, getEffectById, getEffectsByCategory } from '../effects-registry';

describe('effects registry', () => {
    it('has unique ids', () => {
        const ids = EFFECTS_REGISTRY.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every effect has a non-empty name and description', () => {
        for (const effect of EFFECTS_REGISTRY) {
            expect(effect.name.trim().length).toBeGreaterThan(0);
            expect(effect.description.trim().length).toBeGreaterThan(0);
            expect(effect.duration).toBeGreaterThanOrEqual(0);
        }
    });

    it('every category has at least one votable effect', () => {
        expect(getEffectsByCategory('positive').length).toBeGreaterThan(0);
        expect(getEffectsByCategory('negative').length).toBeGreaterThan(0);
        expect(getEffectsByCategory('psychological').length).toBeGreaterThan(0);
    });

    it('the voting pool is large enough for a non-repeating triple', () => {
        expect(VOTABLE_EFFECTS.length).toBeGreaterThanOrEqual(12);
    });

    it('lookup by id works', () => {
        const effect = getEffectById('blackout');
        expect(effect).toBeDefined();
        expect(effect!.category).toBe('psychological');
    });

    it('returns undefined for unknown ids', () => {
        expect(getEffectById('does_not_exist')).toBeUndefined();
    });

    it('remote tiles only reference known ids and stay grouped by section', () => {
        const remote = EFFECTS_REGISTRY.filter(e => e.remoteSection);
        expect(remote.length).toBeGreaterThan(0);
        for (const tile of remote) {
            expect(getEffectById(tile.id)).toBeDefined();
            expect(tile.icon, `tile ${tile.id} needs an icon`).toBeTruthy();
        }
    });
});