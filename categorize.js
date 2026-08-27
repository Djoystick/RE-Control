const fs = require('fs');
const path = 'H:/Work/RE_Control/src/main/game-bridge/VotingManager.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace effectPool with categorized effectPool
const categorizedPool =     private effectPool = [
        // Positive
        { id: 'light_heal', name: 'Подорожник (Лечение 15%)', category: 'positive' },
        { id: 'speed_up', name: 'Адреналин (Ускорение)', category: 'positive' },
        { id: 'care_package', name: 'С небес (Патроны)', category: 'positive' },
        { id: 'green_herb', name: 'Зеленушка (Трава)', category: 'positive' },
        
        // Negative
        { id: 'push_back', name: 'Ветерок (Отброс)', category: 'negative' },
        { id: 'papercut', name: 'Царапина (-5% ХП)', category: 'negative' },
        { id: 'slow_down', name: 'Тяжелые ботинки (Замедление)', category: 'negative' },
        { id: 'empty_mag', name: 'Осечка (Пустой магазин)', category: 'negative' },
        { id: 'disarm', name: 'Пацифист (Оружие заблокировано)', category: 'negative' },
        
        // Psychological / Troll
        { id: 'hop', name: 'Ик! (Подскок)', category: 'psychological' },
        { id: 'spin_180', name: 'Головокружение (180°)', category: 'psychological' },
        { id: 'auto_run', name: 'Леон — спринтер', category: 'psychological' },
        { id: 'fov_narrow', name: 'Клаустрофобия (FOV-)', category: 'psychological' },
        { id: 'fov_wide', name: 'Рыбий глаз (FOV+)', category: 'psychological' },
        { id: 'camera_shake', name: 'Паническая атака', category: 'psychological' },
        { id: 'ui_wipe', name: 'Где мои очки? (UI Off)', category: 'psychological' },
        { id: 'mirror_screen', name: 'Зеркало (Отзеркаливание)', category: 'psychological' },
        { id: 'static_burst', name: 'Помехи экрана (2с)', category: 'psychological' },
        { id: 'invert_controls', name: 'Пьяный геймпад (10с)', category: 'psychological' },
        { id: 'blackout', name: 'Вырубили свет (3с)', category: 'psychological' },
        { id: 'mute_sound', name: 'Немой режим (Без звука)', category: 'psychological' },
        { id: 'fake_mrx', name: 'Свой среди чужих (Шаги Тирана)', category: 'psychological' }
    ];;

content = content.replace(/private effectPool = \[[\s\S]*?\];/, categorizedPool);

// Replace random selection logic in startCycle
const oldLogic = const shuffled = [...this.effectPool].sort(() => 0.5 - Math.random());
        this.options = shuffled.slice(0, 3).map((effect, index) => ({
            id: index + 1,
            effectId: effect.id,
            displayName: effect.name,
            votes: 0
        }));;

const newLogic = 
        const posPool = this.effectPool.filter(e => e.category === 'positive');
        const negPool = this.effectPool.filter(e => e.category === 'negative');
        const psyPool = this.effectPool.filter(e => e.category === 'psychological');
        
        const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
        
        let selectedEffects = [
            getRandom(posPool),
            getRandom(negPool),
            getRandom(psyPool)
        ].filter(Boolean); // Fallback in case a category is empty

        // If for some reason we have less than 3, fill from remaining
        while(selectedEffects.length < 3) {
            const fallback = getRandom(this.effectPool);
            if (!selectedEffects.find(e => e.id === fallback.id)) {
                selectedEffects.push(fallback);
            }
        }
        
        // Shuffle the 3 options so they aren't always 1:Pos 2:Neg 3:Psy
        selectedEffects = selectedEffects.sort(() => 0.5 - Math.random());

        this.options = selectedEffects.map((effect, index) => ({
            id: index + 1,
            effectId: effect.id,
            displayName: effect.name,
            votes: 0
        }));;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(path, content, 'utf8');
console.log('Categorized logic applied successfully!');
