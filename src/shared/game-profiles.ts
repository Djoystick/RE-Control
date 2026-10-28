import { EFFECTS_REGISTRY, type EffectDef } from './effects-registry';

/**
 * Игровые профили (v1.6.0).
 *
 * Lua-мост написан под RE Engine неймспейс `app.ropeway` — это RE2 Remake.
 * RE3 Remake использует тот же неймспейс, поэтому большинство эффектов
 * заводится без изменений; часть (нестандартные камерные вызовы, спец-анимации)
 * требует проверки в игре и может быть отключена для профиля.
 *
 * Профиль определяет, какие эффекты показываются в пуле голосования
 * и на мобильном пульте. Отсутствующие в профиле эффекты честно скрываются,
 * а не падают в рантайме.
 */

export type GameProfileId = 're2' | 're3' | 'generic';

export type EffectCoverage = 'full' | 'basic' | 'none';

export interface GameProfile {
    id: GameProfileId;
    displayName: string;
    /** Насколько полно работают эффекты */
    coverage: EffectCoverage;
    /** Человекочитаемое описание для визарда */
    summary: string;
    /** Эффекты, исключённые из профиля (проверка в игре не пройдена) */
    unsupportedEffects?: string[];
}

export const GAME_PROFILES: Record<GameProfileId, GameProfile> = {
    re2: {
        id: 're2',
        displayName: 'Resident Evil 2 Remake',
        coverage: 'full',
        summary: 'Полный набор: HP, инвентарь, патроны, физика, камера, рендер, все интервенции и босс-раунды.'
    },
    re3: {
        id: 're3',
        displayName: 'Resident Evil 3 Remake',
        coverage: 'basic',
        summary: 'Базовый набор: тот же движок и неймспейс app.ropeway. HP, патроны, физика и рендер заявлены; специфичные камерные и «Тирановые» эффекты требуют проверки в игре и скрыты по умолчанию.',
        // Эти явно завязаны на RE2-специфику (камера/сценарии) и не проверялись в RE3
        unsupportedEffects: ['fake_mrx', 'camera_shake', 'jumpscare']
    },
    generic: {
        id: 'generic',
        displayName: 'Другая игра RE Engine',
        coverage: 'none',
        summary: 'REFramework ставится, но Lua-мост эффектов не адаптирован: голосования и оверлей работают, игровые эффекты не применяются.'
    }
};

/** Какие эффекты доступны в профиле */
export function getProfileEffects(profileId: GameProfileId): EffectDef[] {
    const profile = GAME_PROFILES[profileId] ?? GAME_PROFILES.re2;
    const blocked = new Set(profile.unsupportedEffects ?? []);
    if (profile.coverage === 'none') return [];
    return EFFECTS_REGISTRY.filter(e => !blocked.has(e.id));
}

/** Проверка: доступен ли конкретный эффект в профиле */
export function isEffectSupported(effectId: string, profileId: GameProfileId): boolean {
    const profile = GAME_PROFILES[profileId] ?? GAME_PROFILES.re2;
    if (profile.coverage === 'none') return false;
    return !(profile.unsupportedEffects ?? []).includes(effectId);
}

/** Маппинг id игры из GameDatabase в игровой профиль */
export function resolveProfile(gameId: string): GameProfileId {
    const normalized = (gameId || '').toUpperCase();
    if (normalized === 'RE2') return 're2';
    if (normalized === 'RE3') return 're3';
    return 'generic';
}

export const COVERAGE_BADGE: Record<EffectCoverage, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
    full: { label: 'ПОЛНЫЙ НАБОР', tone: 'ok' },
    basic: { label: 'БАЗОВЫЙ НАБОР', tone: 'warn' },
    none: { label: 'БЕЗ ЭФФЕКТОВ', tone: 'bad' }
};