import { describe, it, expect } from 'vitest';
import {
    GAME_PROFILES,
    getProfileEffects,
    isEffectSupported,
    resolveProfile,
    COVERAGE_BADGE
} from '../game-profiles';
import { EFFECTS_REGISTRY, VOTABLE_EFFECTS } from '../effects-registry';

describe('game profiles', () => {
    it('RE2 is the full-coverage profile with every effect available', () => {
        expect(GAME_PROFILES.re2.coverage).toBe('full');
        expect(getProfileEffects('re2')).toHaveLength(EFFECTS_REGISTRY.length);
        expect(GAME_PROFILES.re2.unsupportedEffects).toBeUndefined();
    });

    it('RE3 is basic: hides only explicitly unverified effects', () => {
        expect(GAME_PROFILES.re3.coverage).toBe('basic');
        const blocked = GAME_PROFILES.re3.unsupportedEffects ?? [];
        expect(blocked.length).toBeGreaterThan(0);

        const available = getProfileEffects('re3');
        expect(available).toHaveLength(EFFECTS_REGISTRY.length - blocked.length);
        for (const id of blocked) {
            expect(available.find(e => e.id === id)).toBeUndefined();
            expect(isEffectSupported(id, 're3')).toBe(false);
        }
    });

    it('RE3 keeps the core effects (heal, ammo, physics)', () => {
        for (const id of ['light_heal', 'refill_ammo', 'spin_180', 'push_back']) {
            expect(isEffectSupported(id, 're3'), `${id} should work in RE3`).toBe(true);
        }
    });

    it('generic profile exposes no effects', () => {
        expect(GAME_PROFILES.generic.coverage).toBe('none');
        expect(getProfileEffects('generic')).toHaveLength(0);
        expect(isEffectSupported('light_heal', 'generic')).toBe(false);
    });

    it('every profile exclusion references a real registry id', () => {
        const ids = new Set(EFFECTS_REGISTRY.map(e => e.id));
        for (const profile of Object.values(GAME_PROFILES)) {
            for (const id of profile.unsupportedEffects ?? []) {
                expect(ids.has(id), `profile ${profile.id} references unknown id ${id}`).toBe(true);
            }
        }
    });

    it('RE3 keeps enough votable effects for a three-option round', () => {
        const votable = getProfileEffects('re3').filter(e => e.votable);
        expect(votable.length).toBeGreaterThanOrEqual(12);
        // And every category must still be representable
        for (const category of ['positive', 'negative', 'psychological']) {
            expect(votable.some(e => e.category === category), `missing ${category} in RE3`).toBe(true);
        }
    });

    it('maps game ids to profiles', () => {
        expect(resolveProfile('RE2')).toBe('re2');
        expect(resolveProfile('re3')).toBe('re3');
        expect(resolveProfile('RE4')).toBe('generic');
        expect(resolveProfile('')).toBe('generic');
        expect(resolveProfile('re2')).toBe('re2');
    });

    it('every coverage level has a badge', () => {
        for (const coverage of ['full', 'basic', 'none'] as const) {
            expect(COVERAGE_BADGE[coverage]).toBeDefined();
            expect(COVERAGE_BADGE[coverage].label.length).toBeGreaterThan(0);
        }
    });

    it('VOTABLE_EFFECTS is a subset of the full RE2 profile', () => {
        const re2Ids = new Set(getProfileEffects('re2').map(e => e.id));
        for (const effect of VOTABLE_EFFECTS) {
            expect(re2Ids.has(effect.id), `${effect.id} missing from RE2 profile`).toBe(true);
        }
    });
});