local Effects = {}

-- Вспомогательные функции для получения объектов
local function get_player()
    local sm = app.ropeway.survivor.SurvivorManager.getSingleton()
    return sm:getSurvivor()
end

local function get_inventory()
    local im = app.ropeway.InventoryManager.getSingleton()
    return im:getInventory()
end

local function get_position(player)
    return player:getTransform():getPosition()
end

-- 1. Полное лечение игрока
function Effects.heal_full()
    log.info("[RE:Control] Активирован эффект: heal_full")
    local player = get_player()
    if not player then return end
    local params = player:getCharacterParameters()
    params:setStatus(app.ropeway.survivor.SurvivorStatus.Fine)
    params:setLife(params:getMaxLife())
end

-- 2. Нанесение урона
function Effects.damage_half()
    log.info("[RE:Control] Активирован эффект: damage_half")
    local player = get_player()
    if not player then return end
    local params = player:getCharacterParameters()
    local current_life = params:getLife()
    local max_life = params:getMaxLife()
    params:setLife(math.max(current_life - math.floor(max_life * 0.5), 1))
    local status = app.ropeway.survivor.SurvivorStatus
    if params:getLife() <= max_life * 0.25 then
        params:setStatus(status.Danger)
    else
        params:setStatus(status.Caution)
    end
end

-- 3. Пополнение патронов в магазине
function Effects.refill_ammo()
    log.info("[RE:Control] Активирован эффект: refill_ammo")
    local inventory = get_inventory()
    if not inventory then return end
    local weapon = inventory:getEquipItem()
    if weapon and weapon:getType() == app.ropeway.ItemType.Weapon then
        local bullets = weapon:getBullets()
        local max_ammo = weapon:getMaxBullets()
        bullets:setCurrent(max_ammo)
    end
end

-- 4. Очистка магазина
function Effects.empty_ammo()
    log.info("[RE:Control] Активирован эффект: empty_ammo")
    local inventory = get_inventory()
    if not inventory then return end
    local weapon = inventory:getEquipItem()
    if weapon and weapon:getType() == app.ropeway.ItemType.Weapon then
        weapon:getBullets():setCurrent(0)
    end
end

-- 5. Добавление First Aid Spray
function Effects.add_item()
    log.info("[RE:Control] Активирован эффект: add_item")
    local inventory = get_inventory()
    if not inventory then return end
    inventory:addItem(app.ropeway.ItemType.FirstAidSpray, 1)
end

-- 6. Удаление случайного лечения или патронов
function Effects.remove_item()
    log.info("[RE:Control] Активирован эффект: remove_item")
    local inventory = get_inventory()
    if not inventory then return end
    local items = inventory:getItems()
    local target_index = nil
    for i = 0, items:size() - 1 do
        local item = items:at(i)
        if item:getType() == app.ropeway.ItemType.HealItem or
           item:getType() == app.ropeway.ItemType.Ammo then
            target_index = i
            break
        end
    end
    if target_index then
        inventory:removeItem(target_index)
    end
end

-- 7. Спавн зомби
function Effects.spawn_zombie()
    log.info("[RE:Control] Активирован эффект: spawn_zombie")
    local player = get_player()
    if not player then return end
    local pos = get_position(player)
    local offset = app.ropeway.EnemyManager.getSingleton():getEnemySetting():getDefaultOffset()
    local enemy_manager = app.ropeway.EnemyManager.getSingleton()
    enemy_manager:spawnEnemy(app.ropeway.EnemyType.Zombie, pos + offset)
end

-- 8. Спавн Лизунга
function Effects.spawn_licker()
    log.info("[RE:Control] Активирован эффект: spawn_licker")
    local player = get_player()
    if not player then return end
    local pos = get_position(player)
    local offset = app.ropeway.EnemyManager.getSingleton():getEnemySetting():getDefaultOffset()
    local enemy_manager = app.ropeway.EnemyManager.getSingleton()
    enemy_manager:spawnEnemy(app.ropeway.EnemyType.Licker, pos + offset)
end

-- 9. Увеличение скорости на 10 секунд
function Effects.speed_up()
    log.info("[RE:Control] Активирован эффект: speed_up")
    local player = get_player()
    if not player then return end
    local params = player:getCharacterParameters()
    local base_speed = params:getMoveSpeedRate()
    params:setMoveSpeedRate(base_speed * 2.0)
    local timer = app.ropeway.TimerManager.getSingleton():createTimer(10.0)
    timer.setOnFinished(function()
        params:setMoveSpeedRate(base_speed)
    end)
    timer:start()
end

-- 10. Резкий страх: тряска камеры и звук
function Effects.jumpscare()
    log.info("[RE:Control] Активирован эффект: jumpscare")
    local camera = app.ropeway.CameraManager.getSingleton():getCamera()
    if camera then
        camera:shake(0.5, 1.0, 15.0)
    end
    local sound = app.ropeway.SoundManager.getSingleton()
    if sound then
        sound:play("event_survivor_scream", 1.0, 1.0)
    end
end

-- 11. slow_down
function Effects.slow_down()
    log.info("[RE:Control] Активирован эффект: slow_down")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:getCharacterParameters()
        local base_speed = params:getMoveSpeedRate()
        params:setMoveSpeedRate(base_speed * 0.5)
        local timer = app.ropeway.TimerManager.getSingleton():createTimer(10.0)
        timer.setOnFinished(function()
            params:setMoveSpeedRate(base_speed)
        end)
        timer:start()
    end)
end

-- 12. infinite_ammo
function Effects.infinite_ammo()
    log.info("[RE:Control] Активирован эффект: infinite_ammo")
    local player = get_player()
    if not player then return end
    pcall(function()
        local inventory = get_inventory()
        if not inventory then return end
        local weapon = inventory:getEquipItem()
        if weapon and weapon:getType() == app.ropeway.ItemType.Weapon then
            local bullets = weapon:getBullets()
            local original_ammo = bullets:getCurrent()
            bullets:setCurrent(999)
            local timer = app.ropeway.TimerManager.getSingleton():createTimer(15.0)
            timer.setOnFinished(function()
                pcall(function() bullets:setCurrent(original_ammo) end)
            end)
            timer:start()
        end
    end)
end

-- 13. drop_item
function Effects.drop_item()
    log.info("[RE:Control] Активирован эффект: drop_item")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local items = inventory:getItems()
        local size = items:size()
        if size > 0 then
            inventory:removeItem(size - 1)
        end
    end)
end

-- 14. give_herb
function Effects.give_herb()
    log.info("[RE:Control] Активирован эффект: give_herb")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local success = pcall(function() inventory:addItem(app.ropeway.ItemType.GreenHerb, 1) end)
        if not success then
             pcall(function() inventory:addItem(app.ropeway.ItemType.FirstAidSpray, 1) end)
        end
    end)
end

-- 15. teleport_up
function Effects.teleport_up()
    log.info("[RE:Control] Активирован эффект: teleport_up")
    local player = get_player()
    if not player then return end
    pcall(function()
        local transform = player:getTransform()
        local pos = transform:getPosition()
        pos.y = pos.y + 2.0
        transform:setPosition(pos)
    end)
end

-- 16. freeze
function Effects.freeze()
    log.info("[RE:Control] Активирован эффект: freeze")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:getCharacterParameters()
        local base_speed = params:getMoveSpeedRate()
        params:setMoveSpeedRate(0.0)
        local timer = app.ropeway.TimerManager.getSingleton():createTimer(5.0)
        timer.setOnFinished(function()
            params:setMoveSpeedRate(base_speed)
        end)
        timer:start()
    end)
end

-- 17. big_head
function Effects.big_head()
    log.info("[RE:Control] Активирован эффект: big_head")
    local player = get_player()
    if not player then return end
    pcall(function()
        local head_joint = player:getTransform():getJointByName("Head")
        if not head_joint then head_joint = player:getTransform():getJointByName("head") end
        if head_joint then
            local scale = head_joint:getLocalScale()
            local orig_x, orig_y, orig_z = scale.x, scale.y, scale.z
            scale.x, scale.y, scale.z = 3.0, 3.0, 3.0
            head_joint:setLocalScale(scale)
            local timer = app.ropeway.TimerManager.getSingleton():createTimer(15.0)
            timer.setOnFinished(function()
                pcall(function()
                    scale.x, scale.y, scale.z = orig_x, orig_y, orig_z
                    head_joint:setLocalScale(scale)
                end)
            end)
            timer:start()
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
        local offset = app.ropeway.EnemyManager.getSingleton():getEnemySetting():getDefaultOffset()
        local enemy_manager = app.ropeway.EnemyManager.getSingleton()
        enemy_manager:spawnEnemy(app.ropeway.EnemyType.ZombieDog, pos + offset)
    end)
end

-- 19. spawn_tyrant
function Effects.spawn_tyrant()
    log.info("[RE:Control] Активирован эффект: spawn_tyrant")
    local player = get_player()
    if not player then return end
    pcall(function()
        local pos = get_position(player)
        local offset = app.ropeway.EnemyManager.getSingleton():getEnemySetting():getDefaultOffset()
        local enemy_manager = app.ropeway.EnemyManager.getSingleton()
        enemy_manager:spawnEnemy(app.ropeway.EnemyType.Tyrant, pos + offset)
    end)
end

-- 20. give_grenade
function Effects.give_grenade()
    log.info("[RE:Control] Активирован эффект: give_grenade")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local success = pcall(function() inventory:addItem(app.ropeway.ItemType.HandGrenade, 1) end)
        if not success then
             pcall(function() inventory:addItem(app.ropeway.ItemType.FirstAidSpray, 1) end)
        end
    end)
end

-- 21. drunk_camera
function Effects.drunk_camera()
    log.info("[RE:Control] Активирован эффект: drunk_camera")
    pcall(function()
        local camera = app.ropeway.CameraManager.getSingleton():getCamera()
        if camera then
            camera:shake(0.2, 0.5, 10.0)
        end
    end)
end

-- 22. heal_small
function Effects.heal_small()
    log.info("[RE:Control] Активирован эффект: heal_small")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:getCharacterParameters()
        local current = params:getLife()
        local max = params:getMaxLife()
        params:setLife(math.min(max, current + (max * 0.25)))
        if params:getLife() > max * 0.5 then
            params:setStatus(app.ropeway.survivor.SurvivorStatus.Fine)
        end
    end)
end

function Effects.push_back()
    log.info("[RE:Control] Активирован эффект: push_back")
    local player = get_player()
    if not player then return end
    pcall(function()
        local transform = player:getTransform()
        local pos = transform:getPosition()
        local forward = transform:getAxisZ()
        pos.x = pos.x - forward.x
        pos.y = pos.y - forward.y
        pos.z = pos.z - forward.z
        transform:setPosition(pos)
    end)
end

function Effects.auto_run()
    log.info("[RE:Control] Активирован эффект: auto_run")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:getCharacterParameters()
        local base_speed = params:getMoveSpeedRate()
        params:setMoveSpeedRate(base_speed * 3.0)
        local timer = app.ropeway.TimerManager.getSingleton():createTimer(3.0)
        timer.setOnFinished(function()
            pcall(function() params:setMoveSpeedRate(base_speed) end)
        end)
        timer:start()
    end)
end

function Effects.fov_narrow()
    log.info("[RE:Control] Активирован эффект: fov_narrow")
    pcall(function()
        local camera = app.ropeway.CameraManager.getSingleton():getCamera()
        if camera then
            local orig = camera:getFov()
            camera:setFov(orig * 0.5)
            local timer = app.ropeway.TimerManager.getSingleton():createTimer(5.0)
            timer.setOnFinished(function()
                pcall(function() camera:setFov(orig) end)
            end)
            timer:start()
        end
    end)
end

function Effects.fov_wide()
    log.info("[RE:Control] Активирован эффект: fov_wide")
    pcall(function()
        local camera = app.ropeway.CameraManager.getSingleton():getCamera()
        if camera then
            local orig = camera:getFov()
            camera:setFov(orig * 1.5)
            local timer = app.ropeway.TimerManager.getSingleton():createTimer(10.0)
            timer.setOnFinished(function()
                pcall(function() camera:setFov(orig) end)
            end)
            timer:start()
        end
    end)
end

function Effects.camera_shake()
    log.info("[RE:Control] Активирован эффект: camera_shake")
    pcall(function()
        local camera = app.ropeway.CameraManager.getSingleton():getCamera()
        if camera then
            camera:shake(0.5, 0.5, 5.0)
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
        local params = player:getCharacterParameters()
        local current = params:getLife()
        local max = params:getMaxLife()
        params:setLife(math.min(max, current + (max * 0.15)))
        if params:getLife() > max * 0.5 then
            params:setStatus(app.ropeway.survivor.SurvivorStatus.Fine)
        end
    end)
end

function Effects.papercut()
    log.info("[RE:Control] Активирован эффект: papercut")
    local player = get_player()
    if not player then return end
    pcall(function()
        local params = player:getCharacterParameters()
        local current = params:getLife()
        local max = params:getMaxLife()
        params:setLife(math.max(1, current - (max * 0.10)))
        if params:getLife() <= max * 0.25 then
            params:setStatus(app.ropeway.survivor.SurvivorStatus.Danger)
        elseif params:getLife() <= max * 0.5 then
            params:setStatus(app.ropeway.survivor.SurvivorStatus.Caution)
        end
    end)
end

function Effects.empty_mag()
    log.info("[RE:Control] Активирован эффект: empty_mag")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        local weapon = inventory:getEquipItem()
        if weapon and weapon:getType() == app.ropeway.ItemType.Weapon then
            weapon:getBullets():setCurrent(0)
        end
    end)
end

function Effects.care_package()
    log.info("[RE:Control] Активирован эффект: care_package")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        inventory:addItem(app.ropeway.ItemType.Ammo, 30)
    end)
end

function Effects.green_herb()
    log.info("[RE:Control] Активирован эффект: green_herb")
    local inventory = get_inventory()
    if not inventory then return end
    pcall(function()
        inventory:addItem(app.ropeway.ItemType.GreenHerb, 1)
    end)
end

function Effects.mute_sound()
    log.info("[RE:Control] Активирован эффект: mute_sound")
    pcall(function()
        local sm = app.ropeway.SoundManager.getSingleton()
        if sm then
            sm:setMasterVolume(0.0)
            local timer = app.ropeway.TimerManager.getSingleton():createTimer(10.0)
            timer.setOnFinished(function()
                pcall(function() sm:setMasterVolume(1.0) end)
            end)
            timer:start()
        end
    end)
end

return Effects
