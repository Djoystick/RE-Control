local Effects = {}
local d2d_font = d2d.Font.new("Arial", 20)

-- Глобальные стейты для временных эффектов
Effects.active_states = {
    invert_controls = 0,
    disarm = 0,
    blackout = 0,
    ui_wipe = 0,
    static_burst = 0
}

-- === БЕЗОПАСНЫЕ ФУНКЦИИ (Anti-Softlock Core) ===
local function get_player_gameobject()
    local sm = sdk.get_managed_singleton("app.ropeway.SurvivorManager")
    if not sm then return nil end
    local player = sm:call("get_PlayerSurvivor")
    if not player then player = sm:call("get_Survivor") end
    if not player then player = sm:call("get_Player") end
    
    if player then
        return player:call("get_GameObject")
    end
    return nil
end

-- === МГНОВЕННЫЕ ЭФФЕКТЫ ===

function Effects.hop()
    log.info("[RE:Control] Effect: hop")
    local go = get_player_gameobject()
    if go then
        local transform = go:call("get_Transform")
        if transform then
            local pos = transform:call("get_Position")
            pos.y = pos.y + 0.6 
            transform:call("set_Position", pos)
        end
    end
end

function Effects.spin_180()
    log.info("[RE:Control] Effect: 180_spin")
    local go = get_player_gameobject()
    if go then
        local transform = go:call("get_Transform")
        if transform then
            -- В REEngine проще всего перевернуть Y ось вращения
            local current_quat = transform:call("get_Rotation")
            if current_quat then
                -- Инвертируем X и Z компоненты кватерниона для поворота на 180 по Y, 
                -- либо воспользуемся Euler-углами
                local angles = transform:call("get_EulerAngle") or transform:call("get_LocalEulerAngles")
                if angles then
                    angles.y = angles.y + 3.14159265359 -- Радианы
                    transform:call("set_LocalEulerAngles", angles)
                end
            end
        end
    end
end

-- === ВРЕМЕННЫЕ ЭФФЕКТЫ (Меняют стейт) ===

function Effects.blackout()
    log.info("[RE:Control] Effect: blackout")
    Effects.active_states.blackout = 3.0 -- 3 секунды
end

function Effects.static_burst()
    log.info("[RE:Control] Effect: static_burst")
    Effects.active_states.static_burst = 2.0 -- 2 секунды
end

function Effects.ui_wipe()
    log.info("[RE:Control] Effect: ui_wipe")
    Effects.active_states.ui_wipe = 15.0 -- 15 секунд
    
    -- Опционально: попытаться найти GuiManager и скрыть его (требует точного API)
    local gui = sdk.get_managed_singleton("app.gui.GUISystem") or sdk.get_managed_singleton("app.ropeway.gui.GuiManager")
    if gui then
        -- gui:call("set_Disp", false) -- Опасно вслепую
    end
end

-- Имплементация для RE:Control
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
    Effects.active_states.invert_controls = 10.0
end

function Effects.disarm()
    log.info("[RE:Control] Effect: disarm")
    Effects.active_states.disarm = 10.0
end

-- === РЕНДЕР (Каждый кадр) ===
re.on_frame(function()
    local delta = re.get_delta_time()
    local screen_w, screen_h = d2d.surface_size()

    -- 1. Вырубили свет (Blackout)
    if Effects.active_states.blackout > 0 then
        Effects.active_states.blackout = Effects.active_states.blackout - delta
        -- Рисуем черный квадрат на весь экран
        d2d.fill_rect(0, 0, screen_w, screen_h, 0xFF000000)
    end

    -- 2. Помехи (Static Burst)
    if Effects.active_states.static_burst > 0 then
        Effects.active_states.static_burst = Effects.active_states.static_burst - delta
        -- Имитация статики: рисуем полупрозрачные серые прямоугольники
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

