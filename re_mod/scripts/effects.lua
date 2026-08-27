```lua
local effects = {}

local player = nil
local weapon = nil
local camera = nil
local enemy_manager = nil

-- Вспомогательная функция для получения игрока
local function get_player()
    if not player then
        player = reframework.get_singleton("PlayerManager"):get_player()
    end
    return player
end

-- Вспомогательная функция для получения текущего оружия
local function get_equipped_weapon()
    if not weapon then
        local p = get_player()
        if p then
            weapon = p:get_equipped_weapon()
        end
    end
    return weapon
end

-- 1. Полностью вылечить игрока
function effects.heal_full()
    local p = get_player()
    if p then
        p:set_health(p:get_max_health())
    end
end

-- 2. Нанести 50% от текущего здоровья в качестве урона
function effects.damage_half()
    local p = get_player()
    if p then
        local current_health = p:get_health()
        local damage = current_health * 0.5
        p:set_health(current_health - damage)
    end
end

-- 3. Заполнить магазин оружия
function effects.refill_ammo()
    local w = get_equipped_weapon()
    if w then
        w:set_ammo(w:get_max_ammo())
    end
end

-- 4. Обнулить магазин оружия
function effects.empty_ammo()
    local w = get_equipped_weapon()
    if w then
        w:set_ammo(0)
    end
end

-- 5. Добавить 5000 Лей
function effects.add_lei()
    local p = get_player()
    if p then
        p:add_lei(5000)
    end
end

-- 6. Убрать 3000 Лей
function effects.remove_lei()
    local p = get_player()
    if p then
        p:add_lei(-3000)
    end
end

-- 7. Заспавнить оборотня
function effects.spawn_lycan()
    local em = reframework.get_singleton("EnemyManager")
    if em then
        em:spawn_enemy("Lycan")
    end
end

-- 8. Заспавнить Molded
function effects.spawn_molded()
    local em = reframework.get_singleton("EnemyManager")
    if em then
        em:spawn_enemy("Molded")
    end
end

-- 9. Увеличить скорость времени на 10 секунд
function effects.speed_up()
    local time_mgr = reframework.get_singleton("TimeManager")
    if time_mgr then
        time_mgr:set_timescale(2.0)
        reframework.delay(10.0, function()
            time_mgr:set_timescale(1.0)
        end)
    end
end

-- 10. Джампскейр: резкое движение камеры и звук
function effects.jumpscare()
    local cam_holder = reframework.get_singleton("CameraManager")
    if cam_holder then
        local cam = cam_holder:get_main_camera()
        if cam then
            cam:shake(10.0, 0.5) -- Интенсивный тряска камеры
        end
    end

    local snd_mgr = reframework.get_singleton("SoundManager")
    if snd_mgr then
        snd_mgr:play_sound("jumpscare_sound") -- Имя звука может быть изменено
    end
end

return effects
```