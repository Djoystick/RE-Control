local Effects = {}

Effects.active_states = {
    blackout = 0,
    static_burst = 0,
    invert = 0,
    speed_up = 0,
    slow_down = 0,
    freeze = 0,
    infinite_ammo = 0,
    drunk = 0,
    hop_timer = 0,
    hop_height = 0,
    fov_narrow = 0,
    fov_wide = 0
}

-- Вспомогательные функции для получения объектов движка RE2
local function get_player()
    local sm = sdk.get_managed_singleton("app.ropeway.SurvivorManager")
    if not sm then return nil end
    return sm:call("get_Player") or sm:call("get_Survivor") or sm:call("get_PlayerSurvivor")
end

local function get_player_gameobject()
    local player = get_player()
    if player then
        return player:call("get_GameObject")
    end
    return nil
end

local function get_hit_point_controller()
    local go = get_player_gameobject()
    if not go then return nil end
    return go:call("getComponent(System.Type)", sdk.typeof("app.ropeway.HitPointController"))
end

local function get_inventory()
    local player = get_player()
    if not player then return nil end
    return player:call("get_Inventory")
end

local function get_main_slot()
    local inv = get_inventory()
    if not inv then return nil end
    return inv:call("get_MainSlot")
end

local function get_player_motion()
    local go = get_player_gameobject()
    if not go then return nil end
    return go:call("getComponent(System.Type)", sdk.typeof("via.motion.Motion"))
end

local function get_camera_system()
    return sdk.get_managed_singleton("app.ropeway.camera.CameraSystem")
end

-- Вспомогательная функция добавления патронов в инвентарь (в карман)
local function add_bullets_to_inventory(bullet_id, amount)
    if not amount or amount <= 0 then return end
    local inv = get_inventory()
    if not inv then return end

    -- 1. Добавляем в буфер запаса оружия
    pcall(function()
        local surplus = inv:call("get_MainSlotSurplusBulletNumber") or 0
        inv:call("set_MainSlotSurplusBulletNumber", surplus + amount)
        log.info("[RE:Control] Surplus запаса увеличен на " .. tostring(amount))
    end)

    -- 2. Ищем физическую пачку патронов в слотах инвентаря
    pcall(function()
        local slots = inv:call("get_Slots")
        if slots then
            local count = slots:call("get_Count") or slots:call("get_Length") or slots:call("get_Size")
            if count then
                for i = 0, count - 1 do
                    local s = slots:call("get_Item", i) or (slots.get_element and slots:get_element(i))
                    if s then
                        local s_bullet_id = s:call("get_BulletID")
                        if not bullet_id or s_bullet_id == bullet_id then
                            local cur_num = s:call("get_Number") or 0
                            local max_num = s:call("get_MaxNumber") or 60
                            s:call("set_Number", math.min(max_num, cur_num + amount))
                            log.info("[RE:Control] Патроны добавлены в слот инвентаря #" .. tostring(i) .. " (было " .. tostring(cur_num) .. ")")
                            return
                        end
                    end
                end
            end
        end
    end)
end

-- 1. Полное лечение игрока (Спрей)
function Effects.heal_full()
    log.info("[RE:Control] Активирован эффект: heal_full")
    local hp = get_hit_point_controller()
    if hp then
        local max_hp = hp:call("get_DefaultHitPoint") or 1200
        hp:call("set_CurrentHitPoint", max_hp)
        log.info("[RE:Control] heal_full: Здоровье восстановлено до максимума (" .. tostring(max_hp) .. ")")
    else
        log.error("[RE:Control] heal_full: HitPointController не найден!")
    end
end

-- 2. Малое лечение (Подорожник, +300 HP)
function Effects.heal_small()
    log.info("[RE:Control] Активирован эффект: heal_small")
    local hp = get_hit_point_controller()
    if hp then
        local cur = hp:call("get_CurrentHitPoint") or 1200
        local max_hp = hp:call("get_DefaultHitPoint") or 1200
        local new_hp = math.min(max_hp, cur + 300)
        hp:call("set_CurrentHitPoint", new_hp)
        log.info("[RE:Control] heal_small: Здоровье увеличено с " .. tostring(cur) .. " до " .. tostring(new_hp))
    else
        log.error("[RE:Control] heal_small: HitPointController не найден!")
    end
end
Effects.light_heal = Effects.heal_small
Effects.green_herb = Effects.heal_small

-- 3. Нанесение 50% урона (Удар ножом)
function Effects.damage_half()
    log.info("[RE:Control] Активирован эффект: damage_half")
    local hp = get_hit_point_controller()
    if hp then
        local cur = hp:call("get_CurrentHitPoint") or 1200
        local dmg = math.floor(cur * 0.5)
        if dmg < 1 then dmg = 1 end
        local new_hp = math.max(1, cur - dmg)
        hp:call("set_CurrentHitPoint", new_hp)
        log.info("[RE:Control] damage_half: Урон " .. tostring(dmg) .. ", осталось HP: " .. tostring(new_hp))
    else
        log.error("[RE:Control] damage_half: HitPointController не найден!")
    end
end

-- 4. Царапина (-150 HP)
function Effects.papercut()
    log.info("[RE:Control] Активирован эффект: papercut")
    local hp = get_hit_point_controller()
    if hp then
        local cur = hp:call("get_CurrentHitPoint") or 1200
        local new_hp = math.max(1, cur - 150)
        hp:call("set_CurrentHitPoint", new_hp)
        log.info("[RE:Control] papercut: Легкий урон, осталось HP: " .. tostring(new_hp))
    else
        log.error("[RE:Control] papercut: HitPointController не найден!")
    end
end

-- 5. Осечка (Патроны аккуратно ссыпаются в карман)
function Effects.empty_ammo()
    log.info("[RE:Control] Активирован эффект: empty_ammo")
    local slot = get_main_slot()
    if slot then
        local current_bullets = slot:call("get_Number") or 0
        local bullet_id = slot:call("get_BulletID")
        if current_bullets > 0 then
            add_bullets_to_inventory(bullet_id, current_bullets)
            log.info("[RE:Control] empty_ammo: " .. tostring(current_bullets) .. " патронов возвращено в карман")
        end
        slot:call("set_Number", 0)
        log.info("[RE:Control] empty_ammo: Магазин оружия опустошен (0 патронов)!")
    else
        log.error("[RE:Control] empty_ammo: MainSlot не найден!")
    end
end
Effects.empty_mag = Effects.empty_ammo
Effects.disarm = Effects.empty_ammo

-- 6. Зарядка обоймы (Боекомплект)
function Effects.refill_ammo()
    log.info("[RE:Control] Активирован эффект: refill_ammo")
    local slot = get_main_slot()
    if slot then
        local max_n = slot:call("get_MaxNumber")
        if not max_n or max_n <= 0 then max_n = 15 end
        slot:call("set_Number", max_n)
        log.info("[RE:Control] refill_ammo: Магазин заполнен (" .. tostring(max_n) .. " патронов)!")
    else
        log.error("[RE:Control] refill_ammo: MainSlot не найден!")
    end
end
Effects.care_package = Effects.refill_ammo
Effects.give_grenade = Effects.refill_ammo

-- 7. Бесконечные патроны на 15 секунд (Безлимит)
function Effects.infinite_ammo()
    log.info("[RE:Control] Активирован эффект: infinite_ammo")
    Effects.refill_ammo()
    Effects.active_states.infinite_ammo = 15.0
end

-- 8. Разворот строго на 180 градусов (Леон + Камера)
function Effects.spin_180()
    log.info("[RE:Control] Effect: spin_180")
    local go = get_player_gameobject()
    if go then
        local transform = go:call("get_Transform")
        if transform then
            local rot = transform:call("get_Rotation")
            if rot then
                local x, y, z, w = rot.x, rot.y, rot.z, rot.w
                rot.x = z
                rot.y = w
                rot.z = -x
                rot.w = -y
                transform:call("set_Rotation", rot)
                log.info("[RE:Control] spin_180: Персонаж развернут ровно на 180°")
            end
        end
    end
    local cs = get_camera_system()
    if cs then
        pcall(function() cs:call("addAnglePlayerCamera", 3.14159265, 0.0) end)
    end
end

-- 9. Отброс назад (push_back / Ветерок)
function Effects.push_back()
    log.info("[RE:Control] Активирован эффект: push_back")
    local go = get_player_gameobject()
    if go then
        local transform = go:call("get_Transform")
        if transform then
            local pos = transform:call("get_Position")
            local fwd = transform:call("get_AxisZ")
            if pos and fwd then
                pos.x = pos.x - fwd.x * 2.5
                pos.z = pos.z - fwd.z * 2.5
                transform:call("set_Position", pos)
                log.info("[RE:Control] push_back: Игрок отброшен назад!")
            end
        end
    end
end

-- 10. Подскок (hop): 1.8 метра вверх на 1.2 секунды
function Effects.hop()
    log.info("[RE:Control] Effect: hop")
    local go = get_player_gameobject()
    if go then
        local transform = go:call("get_Transform")
        if transform then
            local pos = transform:call("get_Position")
            if pos and (Effects.active_states.hop_timer or 0) <= 0 then
                pos.y = pos.y + 1.8
                transform:call("set_Position", pos)
                Effects.active_states.hop_height = 1.8
                Effects.active_states.hop_timer = 1.2
                log.info("[RE:Control] hop: Игрок подброшен на 1.8м в воздух на 1.2с!")
            end
        end
    end
end

-- 11. Слепота (blackout) на 3 секунды
function Effects.blackout()
    log.info("[RE:Control] Effect: blackout")
    Effects.active_states.blackout = 3.0
end

-- 12. Помехи (static_burst / VHS) на 2 секунды
function Effects.static_burst()
    log.info("[RE:Control] Effect: static_burst")
    Effects.active_states.static_burst = 2.0
end
Effects.ui_wipe = Effects.static_burst

-- 13. Адреналин (Ускорение)
function Effects.speed_up()
    log.info("[RE:Control] Активирован эффект: speed_up")
    if re.set_game_speed then
        pcall(re.set_game_speed, 1.8)
    end
    local sm_nat = sdk.get_native_singleton("via.SceneManager")
    local sm_man = sdk.get_managed_singleton("via.SceneManager")
    log.info("[RE:Control] speed_up: sm_nat=" .. tostring(sm_nat) .. ", sm_man=" .. tostring(sm_man))
    if sm_nat then pcall(function() sm_nat:call("set_TimeScale", 1.8) end) end
    if sm_man then pcall(function() sm_man:call("set_TimeScale", 1.8) end) end
    local motion = get_player_motion()
    if motion then pcall(function() motion:call("set_PlaySpeed", 2.0) end) end
    Effects.active_states.speed_up = 8.0
end
Effects.auto_run = Effects.speed_up

-- 14. Замедление (Slow Motion / Bullet Time)
function Effects.slow_down()
    log.info("[RE:Control] Активирован эффект: slow_down")
    if re.set_game_speed then
        pcall(re.set_game_speed, 0.4)
    end
    local sm_nat = sdk.get_native_singleton("via.SceneManager")
    local sm_man = sdk.get_managed_singleton("via.SceneManager")
    log.info("[RE:Control] slow_down: sm_nat=" .. tostring(sm_nat) .. ", sm_man=" .. tostring(sm_man))
    if sm_nat then pcall(function() sm_nat:call("set_TimeScale", 0.4) end) end
    if sm_man then pcall(function() sm_man:call("set_TimeScale", 0.4) end) end
    local motion = get_player_motion()
    if motion then pcall(function() motion:call("set_PlaySpeed", 0.4) end) end
    Effects.active_states.slow_down = 8.0
end

-- 15. Заморозка (Freeze 4 секунды)
function Effects.freeze()
    log.info("[RE:Control] Активирован эффект: freeze")
    if re.set_game_speed then
        pcall(re.set_game_speed, 0.05)
    end
    local sm_nat = sdk.get_native_singleton("via.SceneManager")
    local sm_man = sdk.get_managed_singleton("via.SceneManager")
    if sm_nat then pcall(function() sm_nat:call("set_TimeScale", 0.05) end) end
    if sm_man then pcall(function() sm_man:call("set_TimeScale", 0.05) end) end
    local motion = get_player_motion()
    if motion then pcall(function() motion:call("set_PlaySpeed", 0.0) end) end
    Effects.active_states.freeze = 4.0
end

-- 16. Пьяная камера / Инверт
function Effects.invert_controls()
    log.info("[RE:Control] Effect: invert_controls")
    Effects.active_states.invert = 8.0
end
Effects.drunk_camera = Effects.invert_controls

-- 17. Скример / Испуг (jumpscare)
function Effects.jumpscare()
    log.info("[RE:Control] Активирован эффект: jumpscare")
    local cs = get_camera_system()
    if cs then
        pcall(function() cs:call("forceTwirlPlayerCamera", 15.0) end)
    end
    Effects.active_states.static_burst = 0.5
end

-- 18. Шаги Тирана (fake_mrx)
function Effects.fake_mrx()
    log.info("[RE:Control] Effect: fake_mrx")
    local cs = get_camera_system()
    if cs then
        pcall(function() cs:call("forceTwirlPlayerCamera", 8.0) end)
    end
    Effects.active_states.static_burst = 0.2
end

-- 19. Клаустрофобия (FOV-)
function Effects.fov_narrow()
    log.info("[RE:Control] Effect: fov_narrow")
    local cs = get_camera_system()
    if cs then
        pcall(function()
            local cam = cs:call("get_MainCamera")
            if cam then cam:call("set_Fov", 50.0) end
        end)
    end
    Effects.active_states.fov_narrow = 8.0
end

-- 20. Рыбий глаз (FOV+)
function Effects.fov_wide()
    log.info("[RE:Control] Effect: fov_wide")
    local cs = get_camera_system()
    if cs then
        pcall(function()
            local cam = cs:call("get_MainCamera")
            if cam then cam:call("set_Fov", 110.0) end
        end)
    end
    Effects.active_states.fov_wide = 8.0
end

-- 21. Спавны (атмосферные реакции)
function Effects.spawn_zombie()
    log.info("[RE:Control] Effect: spawn_zombie")
    Effects.push_back()
    Effects.active_states.static_burst = 0.3
end

function Effects.spawn_licker()
    log.info("[RE:Control] Effect: spawn_licker")
    Effects.hop()
    Effects.jumpscare()
end

function Effects.spawn_dog()
    log.info("[RE:Control] Effect: spawn_dog")
    Effects.spin_180()
end

local last_frame_clock = os.clock()

local function get_safe_delta()
    local now = os.clock()
    local dt = now - last_frame_clock
    last_frame_clock = now
    if dt <= 0 or dt > 0.5 then
        dt = 0.0166
    end
    return dt
end

-- Главный покадровый цикл
re.on_frame(function()
    local delta = get_safe_delta()

    -- 1. Бесконечные патроны
    if Effects.active_states.infinite_ammo > 0 then
        Effects.active_states.infinite_ammo = Effects.active_states.infinite_ammo - delta
        local slot = get_main_slot()
        if slot then
            local max_n = slot:call("get_MaxNumber") or 15
            slot:call("set_Number", max_n)
        end
    end

    -- 2. Приземление после подскока (hop)
    if (Effects.active_states.hop_timer or 0) > 0 then
        Effects.active_states.hop_timer = Effects.active_states.hop_timer - delta
        if Effects.active_states.hop_timer <= 0 then
            local go = get_player_gameobject()
            if go and (Effects.active_states.hop_height or 0) > 0 then
                local transform = go:call("get_Transform")
                if transform then
                    local pos = transform:call("get_Position")
                    if pos then
                        pos.y = pos.y - Effects.active_states.hop_height
                        transform:call("set_Position", pos)
                        log.info("[RE:Control] hop: Персонаж успешно приземлился на пол!")
                    end
                end
                Effects.active_states.hop_height = 0
            end
        end
    end

    -- 3. Восстановление скорости времени (speed_up, slow_down, freeze)
    if Effects.active_states.speed_up > 0 then
        Effects.active_states.speed_up = Effects.active_states.speed_up - delta
        if Effects.active_states.speed_up <= 0 then
            if re.set_game_speed then pcall(re.set_game_speed, 1.0) end
            local sm_nat = sdk.get_native_singleton("via.SceneManager")
            if sm_nat then pcall(function() sm_nat:call("set_TimeScale", 1.0) end) end
            local sm_man = sdk.get_managed_singleton("via.SceneManager")
            if sm_man then pcall(function() sm_man:call("set_TimeScale", 1.0) end) end
            local motion = get_player_motion()
            if motion then pcall(function() motion:call("set_PlaySpeed", 1.0) end) end
            log.info("[RE:Control] speed_up завершен, скорость восстановлена")
        end
    end

    if Effects.active_states.slow_down > 0 then
        Effects.active_states.slow_down = Effects.active_states.slow_down - delta
        if Effects.active_states.slow_down <= 0 then
            if re.set_game_speed then pcall(re.set_game_speed, 1.0) end
            local sm_nat = sdk.get_native_singleton("via.SceneManager")
            if sm_nat then pcall(function() sm_nat:call("set_TimeScale", 1.0) end) end
            local sm_man = sdk.get_managed_singleton("via.SceneManager")
            if sm_man then pcall(function() sm_man:call("set_TimeScale", 1.0) end) end
            local motion = get_player_motion()
            if motion then pcall(function() motion:call("set_PlaySpeed", 1.0) end) end
            log.info("[RE:Control] slow_down завершен, скорость восстановлена")
        end
    end

    if Effects.active_states.freeze > 0 then
        Effects.active_states.freeze = Effects.active_states.freeze - delta
        if Effects.active_states.freeze <= 0 then
            if re.set_game_speed then pcall(re.set_game_speed, 1.0) end
            local sm_nat = sdk.get_native_singleton("via.SceneManager")
            if sm_nat then pcall(function() sm_nat:call("set_TimeScale", 1.0) end) end
            local sm_man = sdk.get_managed_singleton("via.SceneManager")
            if sm_man then pcall(function() sm_man:call("set_TimeScale", 1.0) end) end
            local motion = get_player_motion()
            if motion then pcall(function() motion:call("set_PlaySpeed", 1.0) end) end
            log.info("[RE:Control] freeze завершен, скорость восстановлена")
        end
    end

    -- 4. Восстановление FOV
    if Effects.active_states.fov_narrow > 0 then
        Effects.active_states.fov_narrow = Effects.active_states.fov_narrow - delta
        if Effects.active_states.fov_narrow <= 0 then
            local cs = get_camera_system()
            if cs then
                pcall(function()
                    local cam = cs:call("get_MainCamera")
                    if cam then cam:call("set_Fov", 80.0) end
                end)
            end
        end
    end

    if Effects.active_states.fov_wide > 0 then
        Effects.active_states.fov_wide = Effects.active_states.fov_wide - delta
        if Effects.active_states.fov_wide <= 0 then
            local cs = get_camera_system()
            if cs then
                pcall(function()
                    local cam = cs:call("get_MainCamera")
                    if cam then cam:call("set_Fov", 80.0) end
                end)
            end
        end
    end

    -- 5. Мягкое покачивание камеры при инверте (пьяный прицел)
    if Effects.active_states.invert > 0 then
        Effects.active_states.invert = Effects.active_states.invert - delta
        local cs = get_camera_system()
        if cs then
            local sway_yaw = math.sin(os.clock() * 3.5) * 0.02
            local sway_pitch = math.cos(os.clock() * 2.5) * 0.015
            pcall(function() cs:call("addAnglePlayerCamera", sway_yaw, sway_pitch) end)
        end
    end

    -- 6. Графические эффекты (Blackout & Static)
    if Effects.active_states.blackout > 0 then
        Effects.active_states.blackout = Effects.active_states.blackout - delta
        if draw and draw.filled_rect then
            draw.filled_rect(0, 0, 3840, 2160, 0xFF000000)
        end
    end

    if Effects.active_states.static_burst > 0 then
        Effects.active_states.static_burst = Effects.active_states.static_burst - delta
        if draw and draw.filled_rect then
            for i = 1, 35 do
                local rx = math.random(0, 1920)
                local ry = math.random(0, 1080)
                local rw = math.random(60, 600)
                local rh = math.random(10, 80)
                draw.filled_rect(rx, ry, rw, rh, 0xCCAAAAAA)
            end
        end
    end
end)

return Effects
