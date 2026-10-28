/**
 * Единственный источник истины для пула эффектов голосования.
 *
 * На реестр опираются:
 *  - VotingManager (выбор тройки)
 *  - OverlayServer.getMobileRemoteHtml() (генерация плиток)
 *  - Бот-ответы (!effects)
 *  - npm run check:effects (сверка id с lua_scripts/effects.lua)
 */

export type EffectCategory = 'positive' | 'negative' | 'psychological';
export type RemoteSection = 'negative' | 'positive' | 'umbrella';

export interface EffectDef {
    /** Идентификатор, совпадает с именем функции Effects.<id> в effects.lua */
    id: string;
    /** Имя, показываемое в голосовании, пульте и оверлее */
    name: string;
    category: EffectCategory;
    /** Короткое описание механики (для !effects и тултипов) */
    description: string;
    /** Базовая длительность в секундах (0 = мгновенный эффект) */
    duration: number;
    /** Может ли эффект попасть в голосование */
    votable: boolean;
    /** Иконка для плитки Web Remote */
    icon?: string;
    /** Секция на мобильном пульте; undefined = эффект на пульт не выводится */
    remoteSection?: RemoteSection;
}

export const EFFECTS_REGISTRY: EffectDef[] = [
    // ── Positive ──────────────────────────────────────────────────────────
    { id: 'light_heal',    name: 'Подорожник (Лечение 15%)',           category: 'positive',      duration: 0,    votable: true,  icon: '🌿', remoteSection: 'positive', description: '+15% здоровья' },
    { id: 'speed_up',      name: 'Адреналин (Ускорение)',              category: 'positive',      duration: 8,    votable: true,  icon: '⚡', remoteSection: 'positive', description: 'Быстрее на 80%, 8с' },
    { id: 'care_package',  name: 'С небес (Патроны)',                  category: 'positive',      duration: 0,    votable: true,  icon: '📦', remoteSection: 'positive', description: 'Полная обойма' },
    { id: 'green_herb',    name: 'Зеленушка (Трава)',                  category: 'positive',      duration: 0,    votable: true,  description: 'Малый хил' },

    // ── Negative ──────────────────────────────────────────────────────────
    { id: 'push_back',     name: 'Ветерок (Отброс)',                   category: 'negative',      duration: 0,    votable: true,  icon: '💨', remoteSection: 'negative', description: 'Импульс назад' },
    { id: 'papercut',      name: 'Царапина (-5% ХП)',                  category: 'negative',      duration: 0,    votable: true,  icon: '🩹', remoteSection: 'negative', description: 'Лёгкий урон' },
    { id: 'slow_down',     name: 'Тяжелые ботинки (Замедление)',       category: 'negative',      duration: 8,    votable: true,  icon: '🐌', remoteSection: 'negative', description: 'Время ×0.4, 8с' },
    { id: 'empty_mag',     name: 'Осечка (Пустой магазин)',            category: 'negative',      duration: 0,    votable: true,  icon: '🔫', remoteSection: 'negative', description: 'Магазин в карман' },
    { id: 'disarm',        name: 'Пацифист (Оружие заблокировано)',    category: 'negative',      duration: 0,    votable: true,  description: 'Без оружия' },

    // ── Psychological ─────────────────────────────────────────────────────
    { id: 'hop',           name: 'Ик! (Подскок)',                      category: 'psychological', duration: 1.2,  votable: true,  icon: '🦘', remoteSection: 'negative', description: 'Подброс 1.8м' },
    { id: 'spin_180',      name: 'Головокружение (180°)',              category: 'psychological', duration: 0,    votable: true,  icon: '🔄', remoteSection: 'negative', description: 'Разворот 180°' },
    { id: 'auto_run',      name: 'Леон — спринтер',                    category: 'psychological', duration: 8,    votable: true,  description: 'Автобег, 8с' },
    { id: 'fov_narrow',    name: 'Клаустрофобия (FOV-)',               category: 'psychological', duration: 8,    votable: true,  icon: '🔍', remoteSection: 'negative', description: 'FOV 50°, 8с' },
    { id: 'fov_wide',      name: 'Рыбий глаз (FOV+)',                  category: 'psychological', duration: 8,    votable: true,  icon: '🐟', remoteSection: 'negative', description: 'FOV 110°, 8с' },
    { id: 'camera_shake',  name: 'Паническая атака',                   category: 'psychological', duration: 5,    votable: true,  description: 'Тряска камеры, 5с' },
    { id: 'ui_wipe',       name: 'Где мои очки? (UI Off)',             category: 'psychological', duration: 2,    votable: true,  description: 'Помехи UI, 2с' },
    { id: 'static_burst',  name: 'Помехи экрана (2с)',                 category: 'psychological', duration: 2,    votable: true,  icon: '📺', remoteSection: 'negative', description: 'VHS-шум, 2с' },
    { id: 'invert_controls', name: 'Пьяный геймпад (10с)',             category: 'psychological', duration: 10,   votable: true,  icon: '🎮', remoteSection: 'negative', description: 'Инверсия ввода, 10с' },
    { id: 'blackout',      name: 'Вырубили свет (3с)',                 category: 'psychological', duration: 3,    votable: true,  icon: '🕶️', remoteSection: 'negative', description: 'Темный экран, 3с' },
    { id: 'fake_mrx',      name: 'Свой среди чужих (Шаги Тирана)',     category: 'psychological', duration: 5,    votable: true,  icon: '🧥', remoteSection: 'umbrella', description: 'Шаги Тирана, 5с' },

    // ── Служебные (не попадают в голосование, только пульт/API) ──────────
    { id: 'heal_full',     name: 'Лечебный спрей (100% ХП)',           category: 'positive',      duration: 0,    votable: false, icon: '💉', remoteSection: 'positive', description: 'Полный хил' },
    { id: 'damage_half',   name: 'Удар ножом (-50% ХП)',               category: 'negative',      duration: 0,    votable: false, icon: '🩸', remoteSection: 'negative', description: 'Тяжёлый урон' },
    { id: 'refill_ammo',   name: 'Боекомплект (полная обойма)',        category: 'positive',      duration: 0,    votable: false, description: 'Патроны до упора' },
    { id: 'infinite_ammo', name: 'Безлимит патронов (15с)',            category: 'positive',      duration: 15,   votable: false, icon: '♾️', remoteSection: 'positive', description: 'Бесконечные патроны' },
    { id: 'freeze',        name: 'Заморозка (4с)',                     category: 'psychological', duration: 4,    votable: false, icon: '❄️', remoteSection: 'negative', description: 'Стоп времени' },
    { id: 'jumpscare',     name: 'Скример (Испуг)',                    category: 'psychological', duration: 5,    votable: false, icon: '😱', remoteSection: 'negative', description: 'Резкий испуг' },
    { id: 'spawn_zombie',  name: 'Спавн Зомби',                        category: 'negative',      duration: 0,    votable: false, icon: '🧟', remoteSection: 'umbrella', description: 'Отброс + помехи' },
    { id: 'spawn_licker',  name: 'Спавн Лизуна',                       category: 'negative',      duration: 0,    votable: false, icon: '🦎', remoteSection: 'umbrella', description: 'Подскок + скример' },
    { id: 'spawn_dog',     name: 'Спавн Цербера',                      category: 'negative',      duration: 0,    votable: false, icon: '🐕', remoteSection: 'umbrella', description: 'Разворот 180°' },
    { id: 'reset_all',     name: 'Сброс всех эффектов',                category: 'positive',      duration: 0,    votable: false, description: 'Panic/аварийный сброс' },
];

/** Только эффекты, допущенные в голосование */
export const VOTABLE_EFFECTS = EFFECTS_REGISTRY.filter(e => e.votable);

export function getEffectById(id: string): EffectDef | undefined {
    return EFFECTS_REGISTRY.find(e => e.id === id);
}

export function getEffectsByCategory(category: EffectCategory): EffectDef[] {
    return EFFECTS_REGISTRY.filter(e => e.category === category && e.votable);
}
