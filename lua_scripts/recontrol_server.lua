local success, effects = pcall(require, "effects")

log.info("[RE_Control] Запуск File Bridge (Robust IO)...")
log.info("[RE_Control] require('effects') success=" .. tostring(success) .. ", type=" .. type(effects))

if success and effects then
    log.info("[RE_Control] effects.push_back=" .. tostring(effects.push_back))
else
    log.error("[RE_Control] Не удалось загрузить модуль effects: " .. tostring(effects))
end

-- Безопасное чтение файла из reframework/data/
local function read_command_file(filename)
    local f = io.open(filename, "r")
    if f then
        local content = f:read("*a")
        f:close()
        return content
    end
    if fs and type(fs.read) == "function" then
        local ok, content = pcall(fs.read, filename)
        if ok and content then return content end
    end
    return nil
end

-- Безопасная запись файла в reframework/data/
local function write_command_file(filename, content)
    local f = io.open(filename, "w")
    if f then
        f:write(content or "")
        f:close()
        return true
    end
    if fs and type(fs.write) == "function" then
        local ok = pcall(fs.write, filename, content or "")
        if ok then return true end
    end
    return false
end

local is_processing = false

local function check_and_execute()
    if is_processing then return end
    
    local cmd_raw = read_command_file("RE_Control_in.txt")
    if not cmd_raw or cmd_raw == "" then return end
    
    is_processing = true
    write_command_file("RE_Control_in.txt", "")
    
    cmd_raw = cmd_raw:gsub("^%s*(.-)%s*$", "%1")
    if cmd_raw == "" then
        is_processing = false
        return
    end

    log.info("[RE_Control] Получена команда: " .. tostring(cmd_raw))
    local response = "UNKNOWN_COMMAND"

    if success and effects then
        local base_cmd = cmd_raw:match("^MEGA_(.+)")
        local target_func = effects[cmd_raw] or (base_cmd and effects[base_cmd])

        if target_func then
            if base_cmd then
                log.info("[RE_Control] MEGA EFFECT: " .. base_cmd)
            end
            local exec_success, exec_err = pcall(target_func)
            if exec_success then
                if base_cmd then
                    pcall(target_func)
                end
                response = "SUCCESS"
                log.info("[RE_Control] Эффект успешно применен: " .. tostring(cmd_raw))
            else
                log.error("[RE_Control] Ошибка выполнения: " .. tostring(exec_err))
                response = "ERROR"
            end
        else
            log.warn("[RE_Control] Функция не найдена в effects.lua: " .. tostring(cmd_raw))
        end
    else
        log.error("[RE_Control] Модуль effects не загружен!")
    end

    write_command_file("RE_Control_out.txt", response)
    is_processing = false
end

-- 1. Выполняем сразу при загрузке скрипта, если команда уже лежит в файле
check_and_execute()

-- 2. Хукаем игровой цикл движка RE Engine (не зависит от видеокарты/сбросов D3D12)
re.on_application_entry("UpdateBehavior", check_and_execute)

-- 3. Хукаем рендер-кадр
re.on_frame(check_and_execute)
