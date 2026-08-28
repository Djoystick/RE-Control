local Effects = {}

Effects.active_states = {
    blackout = 0,
    ui_wipe = 0,
    static_burst = 0,
    invert = 0,
    auto_run = 0,
    base_speed = 1.0,
    speed_up = 0,
    slow_down = 0,
    infinite_ammo = 0,
    freeze = 0,
    big_head = 0,
    fov_narrow = 0,
    fov_wide = 0,
    mute_sound = 0,
    orig_fov = 90.0,
    orig_speed = 1.0
}

-- Вспомогательные функции для получения объектов
local function get_player()
    local sm = sdk.get_managed_singleton("app.ropeway.SurvivorManager")
    if not sm then return nil end
    local player = sm:call("get_PlayerSurvivor")
    if not player then player = sm:call("get_Survivor") end
    if not player then player = sm:call("get_Player") end
    return player
end

local function get_inventory()
    local player = get_player()
    if not player then return nil end
    local inventory = player:call("get_Inventory")
    if not inventory then
        local im = sdk.get_managed_singleton("app.ropeway.InventoryManager")
        if im then inventory = im:call("get_Inventory") end
    end
    return inventory
end

local function get_position(player)
    local transform = player:call("get_Transform")
    if transform then
        return transform:call("get_Position")
    end
    return nil
end

local function get_player_gameobject()
    local player = get_player()
    if player then
        return player:call("get_GameObject")
    end
    return nil
end

-- 1. Полное лечение игрока
function Effects.heal_full()
    log.info("[RE:Control] Активирован эффект: heal_full")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("getCharacterParameters")
        if params then
            local survivor_status_type = sdk.find_type_definition("app.ropeway.survivor.SurvivorStatus")
            local fine_status = survivor_status_type:get_field("Fine"):get_data(nil)
            params:call("setStatus", fine_status)
            local max_life = params:call("get_MaxLife") or params:call("getMaxLife")
            params:call("setLife", max_life)
            params:call("set_Life", max_life)
        end
    end)
end

-- 2. Нанесение урона
function Effects.damage_half()
    log.info("[RE:Control] Активирован эффект: damage_half")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("getCharacterParameters")
        if params then
            local current_life = params:call("get_Life") or params:call("getLife")
            local max_life = params:call("get_MaxLife") or params:call("getMaxLife")
            local new_life = math.max(current_life - math.floor(max_life * 0.5), 1)
            params:call("setLife", new_life)
            params:call("set_Life", new_life)
            
            local survivor_status_type = sdk.find_type_definition("app.ropeway.survivor.SurvivorStatus")
            local danger_status = survivor_status_type:get_field("Danger"):get_data(nil)
            local caution_status = survivor_status_type:get_field("Caution"):get_data(nil)
            if new_life <= max_life * 0.25 then
                params:call("setStatus", danger_status)
            else
                params:call("setStatus", caution_status)
            end
        end
    end)
end

-- 3. Пополнение патронов в магазине
function Effects.refill_ammo()
    log.info("[RE:Control] Активирован эффект: refill_ammo")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local weapon = inventory:call("get_EquipItem") or inventory:call("getEquipItem")
        if weapon then
            local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
            local weapon_type = item_type_def:get_field("Weapon"):get_data(nil)
            if weapon:call("get_Type") == weapon_type or weapon:call("getType") == weapon_type then
                local bullets = weapon:call("get_Bullets") or weapon:call("getBullets")
                local max_ammo = weapon:call("get_MaxBullets") or weapon:call("getMaxBullets")
                if bullets then
                    bullets:call("set_Current", max_ammo)
                    bullets:call("setCurrent", max_ammo)
                end
            end
        end
    end)
end

-- 4. Очистка магазина
function Effects.empty_ammo()
    log.info("[RE:Control] Активирован эффект: empty_ammo")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local weapon = inventory:call("get_EquipItem") or inventory:call("getEquipItem")
        if weapon then
            local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
            local weapon_type = item_type_def:get_field("Weapon"):get_data(nil)
            if weapon:call("get_Type") == weapon_type or weapon:call("getType") == weapon_type then
                local bullets = weapon:call("get_Bullets") or weapon:call("getBullets")
                if bullets then
                    bullets:call("set_Current", 0)
                    bullets:call("setCurrent", 0)
                end
            end
        end
    end)
end

-- 5. Добавление First Aid Spray
function Effects.add_item()
    log.info("[RE:Control] Активирован эффект: add_item")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
        local spray_type = item_type_def:get_field("FirstAidSpray"):get_data(nil)
        inventory:call("addItem", spray_type, 1)
    end)
end

-- 6. Удаление случайного лечения или патронов
function Effects.remove_item()
    log.info("[RE:Control] Активирован эффект: remove_item")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local items = inventory:call("get_Items") or inventory:call("getItems")
        if items then
            local size = items:call("get_Count") or items:call("size")
            local target_index = nil
            local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
            local heal_type = item_type_def:get_field("HealItem"):get_data(nil)
            local ammo_type = item_type_def:get_field("Ammo"):get_data(nil)
            for i = 0, size - 1 do
                local item = items:call("get_Item", i) or items:call("at", i)
                if item then
                    local t = item:call("get_Type") or item:call("getType")
                    if t == heal_type or t == ammo_type then
                        target_index = i
                        break
                    end
                end
            end
            if target_index then
                inventory:call("removeItem", target_index)
            end
        end
    end)
end

-- 7. Спавн зомби
function Effects.spawn_zombie()
    log.info("[RE:Control] Активирован эффект: spawn_zombie")
    local player = get_player()
    if not player then return end
    pcall(function()
        local pos = get_position(player)
        local enemy_manager = sdk.get_managed_singleton("app.ropeway.EnemyManager")
        if enemy_manager and pos then
            local setting = enemy_manager:call("get_EnemySetting") or enemy_manager:call("getEnemySetting")
            local offset = setting:call("get_DefaultOffset") or setting:call("getDefaultOffset")
            local enemy_type_def = sdk.find_type_definition("app.ropeway.EnemyType")
            local zombie_type = enemy_type_def:get_field("Zombie"):get_data(nil)
            local spawn_pos = pos
            if offset then
                spawn_pos.x = spawn_pos.x + offset.x
                spawn_pos.y = spawn_pos.y + offset.y
                spawn_pos.z = spawn_pos.z + offset.z
            end
            enemy_manager:call("spawnEnemy", zombie_type, spawn_pos)
        end
    end)
end

-- 8. Спавн Лизунга
function Effects.spawn_licker()
    log.info("[RE:Control] Активирован эффект: spawn_licker")
    local player = get_player()
    if not player then return end
    pcall(function()
        local pos = get_position(player)
        local enemy_manager = sdk.get_managed_singleton("app.ropeway.EnemyManager")
        if enemy_manager and pos then
            local setting = enemy_manager:call("get_EnemySetting") or enemy_manager:call("getEnemySetting")
            local offset = setting:call("get_DefaultOffset") or setting:call("getDefaultOffset")
            local enemy_type_def = sdk.find_type_definition("app.ropeway.EnemyType")
            local licker_type = enemy_type_def:get_field("Licker"):get_data(nil)
            local spawn_pos = pos
            if offset then
                spawn_pos.x = spawn_pos.x + offset.x
                spawn_pos.y = spawn_pos.y + offset.y
                spawn_pos.z = spawn_pos.z + offset.z
            end
            enemy_manager:call("spawnEnemy", licker_type, spawn_pos)
        end
    end)
end

-- 9. Увеличение скорости на 10 секунд
function Effects.speed_up()
    log.info("[RE:Control] Активирован эффект: speed_up")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("getCharacterParameters")
        if params then
            local base_speed = params:call("get_MoveSpeedRate") or params:call("getMoveSpeedRate") or 1.0
            Effects.active_states.orig_speed = base_speed
            params:call("setMoveSpeedRate", base_speed * 2.0)
            params:call("set_MoveSpeedRate", base_speed * 2.0)
            Effects.active_states.speed_up = 10.0
        end
    end)
end

-- 10. Резкий страх: тряска камеры и звук
function Effects.jumpscare()
    log.info("[RE:Control] Активирован эффект: jumpscare")
    pcall(function()
        local cm = sdk.get_managed_singleton("app.ropeway.CameraManager")
        local camera = nil
        if cm then camera = cm:call("get_Camera") or cm:call("get_MainCamera") end
        if camera then
            camera:call("shake", 0.5, 1.0, 15.0)
        end
        local sound = sdk.get_managed_singleton("app.ropeway.SoundManager")
        if sound then
            sound:call("play", "event_survivor_scream", 1.0, 1.0)
        end
    end)
end

-- 11. slow_down
function Effects.slow_down()
    log.info("[RE:Control] Активирован эффект: slow_down")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("getCharacterParameters")
        if params then
            local base_speed = params:call("get_MoveSpeedRate") or params:call("getMoveSpeedRate") or 1.0
            Effects.active_states.orig_speed = base_speed
            params:call("setMoveSpeedRate", base_speed * 0.5)
            params:call("set_MoveSpeedRate", base_speed * 0.5)
            Effects.active_states.slow_down = 10.0
        end
    end)
end

-- 12. infinite_ammo
function Effects.infinite_ammo()
    log.info("[RE:Control] Активирован эффект: infinite_ammo")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local weapon = inventory:call("get_EquipItem") or inventory:call("getEquipItem")
        if weapon then
            local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
            local weapon_type = item_type_def:get_field("Weapon"):get_data(nil)
            if weapon:call("get_Type") == weapon_type or weapon:call("getType") == weapon_type then
                local bullets = weapon:call("get_Bullets") or weapon:call("getBullets")
                if bullets then
                    bullets:call("set_Current", 999)
                    bullets:call("setCurrent", 999)
                    Effects.active_states.infinite_ammo = 15.0
                end
            end
        end
    end)
end

-- 13. drop_item
function Effects.drop_item()
    log.info("[RE:Control] Активирован эффект: drop_item")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local items = inventory:call("get_Items") or inventory:call("getItems")
        if items then
            local size = items:call("get_Count") or items:call("size")
            if size > 0 then
                inventory:call("removeItem", size - 1)
            end
        end
    end)
end

-- 14. give_herb
function Effects.give_herb()
    log.info("[RE:Control] Активирован эффект: give_herb")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
        local herb_type = item_type_def:get_field("GreenHerb"):get_data(nil)
        local spray_type = item_type_def:get_field("FirstAidSpray"):get_data(nil)
        local success = pcall(function() inventory:call("addItem", herb_type, 1) end)
        if not success then
             pcall(function() inventory:call("addItem", spray_type, 1) end)
        end
    end)
end

-- 15. teleport_up
function Effects.teleport_up()
    log.info("[RE:Control] Активирован эффект: teleport_up")
    local player = get_player()
    if not player then return end
    pcall(function()
        local transform = player:call("get_Transform")
        if transform then
            local pos = transform:call("get_Position")
            if pos then
                pos.y = pos.y + 2.0
                transform:call("set_Position", pos)
                transform:call("setPosition", pos)
            end
        end
    end)
end

-- 16. freeze
function Effects.freeze()
    log.info("[RE:Control] Активирован эффект: freeze")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("getCharacterParameters")
        if params then
            local base_speed = params:call("get_MoveSpeedRate") or params:call("getMoveSpeedRate") or 1.0
            Effects.active_states.orig_speed = base_speed
            params:call("setMoveSpeedRate", 0.0)
            params:call("set_MoveSpeedRate", 0.0)
            Effects.active_states.freeze = 5.0
        end
    end)
end

-- 17. big_head
function Effects.big_head()
    log.info("[RE:Control] Активирован эффект: big_head")
    local player = get_player()
    if not player then return end
    pcall(function()
        local transform = player:call("get_Transform")
        if transform then
            local head_joint = transform:call("getJointByName", "Head") or transform:call("getJointByName", "head")
            if head_joint then
                local scale = head_joint:call("get_LocalScale") or head_joint:call("getLocalScale")
                if scale then
                    scale.x, scale.y, scale.z = 3.0, 3.0, 3.0
                    head_joint:call("set_LocalScale", scale)
                    head_joint:call("setLocalScale", scale)
                    Effects.active_states.big_head = 15.0
                end
            end
        end
    end)
end

-- 18. spawn_dog
function Effects.spawn_dog()
    log.info("[RE:Control] Активирован эффект: spawn_dog")
    local player = get_player()
    if not player then return end
    pcall(function()
        local pos = get_position(player)
        local enemy_manager = sdk.get_managed_singleton("app.ropeway.EnemyManager")
        if enemy_manager and pos then
            local setting = enemy_manager:call("get_EnemySetting") or enemy_manager:call("getEnemySetting")
            local offset = setting:call("get_DefaultOffset") or setting:call("getDefaultOffset")
            local enemy_type_def = sdk.find_type_definition("app.ropeway.EnemyType")
            local dog_type = enemy_type_def:get_field("ZombieDog"):get_data(nil)
            local spawn_pos = pos
            if offset then
                spawn_pos.x = spawn_pos.x + offset.x
                spawn_pos.y = spawn_pos.y + offset.y
                spawn_pos.z = spawn_pos.z + offset.z
            end
            enemy_manager:call("spawnEnemy", dog_type, spawn_pos)
        end
    end)
end

-- 19. spawn_tyrant
function Effects.spawn_tyrant()
    log.info("[RE:Control] Активирован эффект: spawn_tyrant")
    local player = get_player()
    if not player then return end
    pcall(function()
        local pos = get_position(player)
        local enemy_manager = sdk.get_managed_singleton("app.ropeway.EnemyManager")
        if enemy_manager and pos then
            local setting = enemy_manager:call("get_EnemySetting") or enemy_manager:call("getEnemySetting")
            local offset = setting:call("get_DefaultOffset") or setting:call("getDefaultOffset")
            local enemy_type_def = sdk.find_type_definition("app.ropeway.EnemyType")
            local tyrant_type = enemy_type_def:get_field("Tyrant"):get_data(nil)
            local spawn_pos = pos
            if offset then
                spawn_pos.x = spawn_pos.x + offset.x
                spawn_pos.y = spawn_pos.y + offset.y
                spawn_pos.z = spawn_pos.z + offset.z
            end
            enemy_manager:call("spawnEnemy", tyrant_type, spawn_pos)
        end
    end)
end

-- 20. give_grenade
function Effects.give_grenade()
    log.info("[RE:Control] Активирован эффект: give_grenade")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
        local grenade_type = item_type_def:get_field("HandGrenade"):get_data(nil)
        local spray_type = item_type_def:get_field("FirstAidSpray"):get_data(nil)
        local success = pcall(function() inventory:call("addItem", grenade_type, 1) end)
        if not success then
             pcall(function() inventory:call("addItem", spray_type, 1) end)
        end
    end)
end

-- 21. drunk_camera
function Effects.drunk_camera()
    log.info("[RE:Control] Активирован эффект: drunk_camera")
    pcall(function()
        local cm = sdk.get_managed_singleton("app.ropeway.CameraManager")
        local camera = nil
        if cm then camera = cm:call("get_Camera") or cm:call("get_MainCamera") end
        if camera then
            camera:call("shake", 0.2, 0.5, 10.0)
        end
    end)
end

-- 22. heal_small
function Effects.heal_small()
    log.info("[RE:Control] Активирован эффект: heal_small")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("getCharacterParameters")
        if params then
            local current = params:call("get_Life") or params:call("getLife")
            local max = params:call("get_MaxLife") or params:call("getMaxLife")
            local new_life = math.min(max, current + (max * 0.25))
            params:call("setLife", new_life)
            params:call("set_Life", new_life)
            
            if new_life > max * 0.5 then
                local survivor_status_type = sdk.find_type_definition("app.ropeway.survivor.SurvivorStatus")
                local fine_status = survivor_status_type:get_field("Fine"):get_data(nil)
                params:call("setStatus", fine_status)
            end
        end
    end)
end

function Effects.push_back()
    log.info("[RE:Control] Активирован эффект: push_back")
    local player = get_player()
    if not player then return end
    pcall(function()
        local transform = player:call("get_Transform")
        if transform then
            local pos = transform:call("get_Position")
            local forward = transform:call("get_AxisZ") or transform:call("getAxisZ")
            if pos and forward then
                pos.x = pos.x - forward.x
                pos.y = pos.y - forward.y
                pos.z = pos.z - forward.z
                transform:call("set_Position", pos)
                transform:call("setPosition", pos)
            end
        end
    end)
end

function Effects.auto_run()
    log.info("[RE:Control] Effect: auto_run")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("get_CharacterStatus") or player:call("getCharacterParameters")
        if not params then return end
        local base_speed = params:call("get_MoveSpeedRate") or params:call("getMoveSpeedRate") or 1.0
        Effects.active_states.orig_speed = base_speed
        params:call("set_MoveSpeedRate", base_speed * 3.0)
        params:call("setMoveSpeedRate", base_speed * 3.0)
        
        Effects.active_states.auto_run = 3.0
    end)
end

function Effects.fov_narrow()
    log.info("[RE:Control] Активирован эффект: fov_narrow")
    pcall(function()
        local cm = sdk.get_managed_singleton("app.ropeway.CameraManager")
        local camera = nil
        if cm then camera = cm:call("get_Camera") or cm:call("get_MainCamera") end
        if camera then
            local orig = camera:call("get_Fov") or camera:call("getFov") or 90.0
            Effects.active_states.orig_fov = orig
            camera:call("set_Fov", orig * 0.5)
            camera:call("setFov", orig * 0.5)
            Effects.active_states.fov_narrow = 5.0
        end
    end)
end

function Effects.fov_wide()
    log.info("[RE:Control] Активирован эффект: fov_wide")
    pcall(function()
        local cm = sdk.get_managed_singleton("app.ropeway.CameraManager")
        local camera = nil
        if cm then camera = cm:call("get_Camera") or cm:call("get_MainCamera") end
        if camera then
            local orig = camera:call("get_Fov") or camera:call("getFov") or 90.0
            camera:call("set_Fov", orig * 1.5)
            camera:call("setFov", orig * 1.5)
            Effects.active_states.fov_wide = 10.0
            Effects.active_states.orig_fov = orig
        end
    end)
end

function Effects.camera_shake()
    log.info("[RE:Control] Активирован эффект: camera_shake")
    pcall(function()
        local cm = sdk.get_managed_singleton("app.ropeway.CameraManager")
        local camera = nil
        if cm then camera = cm:call("get_Camera") or cm:call("get_MainCamera") end
        if camera then
            camera:call("shake", 0.5, 0.5, 5.0)
        end
    end)
end

function Effects.mirror_screen()
    log.info("[RE:Control] Активирован эффект: mirror_screen")
    pcall(function()
        -- Fake mirror_screen
    end)
end

function Effects.light_heal()
    log.info("[RE:Control] Активирован эффект: light_heal")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("getCharacterParameters")
        if params then
            local current = params:call("get_Life") or params:call("getLife")
            local max = params:call("get_MaxLife") or params:call("getMaxLife")
            local new_life = math.min(max, current + (max * 0.15))
            params:call("setLife", new_life)
            params:call("set_Life", new_life)
            if new_life > max * 0.5 then
                local survivor_status_type = sdk.find_type_definition("app.ropeway.survivor.SurvivorStatus")
                local fine_status = survivor_status_type:get_field("Fine"):get_data(nil)
                params:call("setStatus", fine_status)
            end
        end
    end)
end

function Effects.papercut()
    log.info("[RE:Control] Активирован эффект: papercut")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:call("get_CharacterParameter") or player:call("getCharacterParameters")
        if params then
            local current = params:call("get_Life") or params:call("getLife")
            local max = params:call("get_MaxLife") or params:call("getMaxLife")
            local new_life = math.max(1, current - (max * 0.10))
            params:call("setLife", new_life)
            params:call("set_Life", new_life)
            
            local survivor_status_type = sdk.find_type_definition("app.ropeway.survivor.SurvivorStatus")
            local danger_status = survivor_status_type:get_field("Danger"):get_data(nil)
            local caution_status = survivor_status_type:get_field("Caution"):get_data(nil)
            if new_life <= max * 0.25 then
                params:call("setStatus", danger_status)
            elseif new_life <= max * 0.5 then
                params:call("setStatus", caution_status)
            end
        end
    end)
end

function Effects.disarm()
    log.info("[RE:Control] Effect: disarm")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local weapon = inventory:call("get_EquipItem") or inventory:call("get_EquipWeapon")
        if weapon then
            local bullets = weapon:call("get_Bullets") or weapon:call("get_Ammo")
            if bullets then
                bullets:call("set_Current", 0)
                bullets:call("set_Num", 0)
            end
        end
    end)
end

function Effects.care_package()
    log.info("[RE:Control] Активирован эффект: care_package")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
        local ammo_type = item_type_def:get_field("Ammo"):get_data(nil)
        inventory:call("addItem", ammo_type, 30)
    end)
end

function Effects.green_herb()
    log.info("[RE:Control] Активирован эффект: green_herb")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local item_type_def = sdk.find_type_definition("app.ropeway.ItemType")
        local herb_type = item_type_def:get_field("GreenHerb"):get_data(nil)
        inventory:call("addItem", herb_type, 1)
    end)
end

function Effects.mute_sound()
    log.info("[RE:Control] Активирован эффект: mute_sound")
    pcall(function()
        local sm = sdk.get_managed_singleton("app.ropeway.SoundManager")
        if sm then
            sm:call("set_MasterVolume", 0.0)
            sm:call("setMasterVolume", 0.0)
            Effects.active_states.mute_sound = 10.0
        end
    end)
end

function Effects.hop()
    log.info("[RE:Control] Effect: hop")
    local go = get_player_gameobject()
    if go then
        local transform = go:call("get_Transform")
        if transform then
            local pos = transform:call("get_Position")
            if pos then
                pos.y = pos.y + 2.0
                transform:call("set_Position", pos)
            end
        end
    end
end

function Effects.spin_180()
    log.info("[RE:Control] Effect: spin_180")
    local go = get_player_gameobject()
    if go then
        local transform = go:call("get_Transform")
        if transform then
            local rot = transform:call("get_Rotation")
            if rot then
                rot.y = -rot.y
                transform:call("set_Rotation", rot)
            end
        end
    end
end

function Effects.blackout()
    log.info("[RE:Control] Effect: blackout")
    Effects.active_states.blackout = 3.0
end

function Effects.static_burst()
    log.info("[RE:Control] Effect: static_burst")
    Effects.active_states.static_burst = 2.0
end

function Effects.ui_wipe()
    log.info("[RE:Control] Effect: ui_wipe")
    Effects.active_states.ui_wipe = 15.0
end

function Effects.fake_mrx()
    log.info("[RE:Control] Effect: fake_mrx")
    local wwise = sdk.get_managed_singleton("via.wwise.WwiseManager")
    if wwise then
        pcall(function() 
            wwise:call("triggerObjectSE", "se_em_tyrant_step", get_player_gameobject()) 
        end)
    end
end

function Effects.invert_controls()
    log.info("[RE:Control] Effect: invert_controls")
    Effects.active_states.invert = 10.0
end

local function reset_speed()
    local player = get_player()
    if player then
        pcall(function()
            local params = player:call("get_CharacterParameter") or player:call("get_CharacterStatus") or player:call("getCharacterParameters")
            if params and Effects.active_states.orig_speed then 
                params:call("set_MoveSpeedRate", Effects.active_states.orig_speed) 
                params:call("setMoveSpeedRate", Effects.active_states.orig_speed) 
            end
        end)
    end
end

local function reset_fov()
    pcall(function()
        local cm = sdk.get_managed_singleton("app.ropeway.CameraManager")
        if cm then
            local camera = cm:call("get_Camera") or cm:call("get_MainCamera")
            if camera and Effects.active_states.orig_fov then 
                camera:call("set_Fov", Effects.active_states.orig_fov) 
                camera:call("setFov", Effects.active_states.orig_fov)
            end
        end
    end)
end

re.on_frame(function()
    local delta = re.get_delta_time()
    
    if Effects.active_states.auto_run > 0 then
        Effects.active_states.auto_run = Effects.active_states.auto_run - delta
        if Effects.active_states.auto_run <= 0 then
            reset_speed()
        end
    end
    
    if Effects.active_states.speed_up > 0 then
        Effects.active_states.speed_up = Effects.active_states.speed_up - delta
        if Effects.active_states.speed_up <= 0 then
            reset_speed()
        end
    end
    
    if Effects.active_states.slow_down > 0 then
        Effects.active_states.slow_down = Effects.active_states.slow_down - delta
        if Effects.active_states.slow_down <= 0 then
            reset_speed()
        end
    end
    
    if Effects.active_states.freeze > 0 then
        Effects.active_states.freeze = Effects.active_states.freeze - delta
        if Effects.active_states.freeze <= 0 then
            reset_speed()
        end
    end

    if Effects.active_states.fov_narrow > 0 then
        Effects.active_states.fov_narrow = Effects.active_states.fov_narrow - delta
        if Effects.active_states.fov_narrow <= 0 then
            reset_fov()
        end
    end
    
    if Effects.active_states.fov_wide > 0 then
        Effects.active_states.fov_wide = Effects.active_states.fov_wide - delta
        if Effects.active_states.fov_wide <= 0 then
            reset_fov()
        end
    end
    
    if Effects.active_states.mute_sound > 0 then
        Effects.active_states.mute_sound = Effects.active_states.mute_sound - delta
        if Effects.active_states.mute_sound <= 0 then
            pcall(function()
                local sm = sdk.get_managed_singleton("app.ropeway.SoundManager")
                if sm then
                    sm:call("set_MasterVolume", 1.0)
                    sm:call("setMasterVolume", 1.0)
                end
            end)
        end
    end
    
    if Effects.active_states.big_head > 0 then
        Effects.active_states.big_head = Effects.active_states.big_head - delta
        if Effects.active_states.big_head <= 0 then
            local player = get_player()
            if player then
                pcall(function()
                    local transform = player:call("get_Transform")
                    if transform then
                        local head_joint = transform:call("getJointByName", "Head") or transform:call("getJointByName", "head")
                        if head_joint then
                            local scale = head_joint:call("get_LocalScale") or head_joint:call("getLocalScale")
                            if scale then
                                scale.x, scale.y, scale.z = 1.0, 1.0, 1.0
                                head_joint:call("set_LocalScale", scale)
                                head_joint:call("setLocalScale", scale)
                            end
                        end
                    end
                end)
            end
        end
    end
end)

re.on_draw_ui(function()
    local screen_w = 1920
    local screen_h = 1080

    if Effects.active_states.blackout > 0 then
        Effects.active_states.blackout = Effects.active_states.blackout - re.get_delta_time()
        d2d.fill_rect(0, 0, screen_w, screen_h, 0xFF000000)
    end

    if Effects.active_states.static_burst > 0 then
        Effects.active_states.static_burst = Effects.active_states.static_burst - re.get_delta_time()
        for i = 1, 50 do
            local x = math.random(0, screen_w)
            local y = math.random(0, screen_h)
            local w = math.random(10, 300)
            local h = math.random(5, 50)
            d2d.fill_rect(x, y, w, h, 0x88AAAAAA)
        end
    end
end)

return Effects
