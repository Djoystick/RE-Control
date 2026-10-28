local success, effects = pcall(require, "effects")

log.info("[RE_Control] Запуск File Bridge v2 (Robust JSON-RPC & Correlation ID)...")
log.info("[RE_Control] require('effects') success=" .. tostring(success) .. ", type=" .. type(effects))

if success and effects then
    log.info("[RE_Control] effects loaded successfully")
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
local last_poll_time = 0

local function check_and_execute()
    if is_processing then return end

    -- Оптимизация производительности: опрос не чаще 20 раз в секунду (каждые 50 мс)
    local now = os.clock()
    if now - last_poll_time < 0.05 then return end
    last_poll_time = now
    
    local cmd_raw = read_command_file("RE_Control_in.txt")
    if not cmd_raw or cmd_raw == "" then return end
    
    is_processing = true
    write_command_file("RE_Control_in.txt", "")
    
    cmd_raw = cmd_raw:gsub("^%s*(.-)%s*$", "%1")
    if cmd_raw == "" then
        is_processing = false
        return
    end

    local cmd_id = "legacy"
    local method = cmd_raw
    local params = nil

    -- Попытка распарсить JSON-RPC формат
    if json and type(json.load_string) == "function" then
        local ok, parsed = pcall(json.load_string, cmd_raw)
        if ok and type(parsed) == "table" and parsed.method then
            cmd_id = parsed.id or "legacy"
            method = parsed.method
            params = parsed.params
        end
    end

    log.info("[RE_Control] Получена команда [" .. tostring(cmd_id) .. "]: " .. tostring(method))
    local status = "UNKNOWN_COMMAND"
    local result = nil
    local error_msg = nil

    if success and effects then
        local base_cmd = method:match("^MEGA_(.+)")
        local target_func = effects[method] or (base_cmd and effects[base_cmd])

        if target_func then
            if base_cmd then
                log.info("[RE_Control] MEGA EFFECT: " .. base_cmd)
                if type(params) == "table" then
                    params.is_mega = true
                else
                    params = { value = params, is_mega = true }
                end
            end
            local exec_success, exec_ret = pcall(target_func, params)
            if exec_success then
                status = "SUCCESS"
                -- Эффект может вернуть таблицу с duration (секунды) для оверлея
                if type(exec_ret) == "table" and type(exec_ret.duration) == "number" then
                    result = exec_ret
                else
                    result = "OK"
                end
                log.info("[RE_Control] Эффект успешно применен: " .. tostring(method))
            else
                log.error("[RE_Control] Ошибка выполнения: " .. tostring(exec_ret))
                status = "ERROR"
                error_msg = tostring(exec_ret)
            end
        else
            log.warn("[RE_Control] Функция не найдена в effects.lua: " .. tostring(method))
            error_msg = "Function not found: " .. tostring(method)
        end
    else
        log.error("[RE_Control] Модуль effects не загружен!")
        status = "ERROR"
        error_msg = "Module effects not loaded"
    end

    -- Формирование ответа с Correlation ID
    local response_str = ""
    if json and type(json.dump_string) == "function" then
        local res_table = {
            id = cmd_id,
            status = status,
            result = result,
            error = error_msg
        }
        local ok, dumped = pcall(json.dump_string, res_table)
        if ok and dumped then
            response_str = dumped
        end
    end

    if response_str == "" then
        -- Fallback для простых строковых ответов
        response_str = status
    end

    write_command_file("RE_Control_out.txt", response_str)
    is_processing = false
end

-- 1. Выполняем сразу при загрузке скрипта, если команда уже лежит в файле
check_and_execute()

-- 2. Хукаем рендер-кадр с частотой до 20 раз/сек (вместо двойного опроса на каждом типе кадра)
re.on_frame(check_and_execute)

-- 3. Очистка состояния при сбросе скрипта / перезагрузке
re.on_script_reset(function()
    log.info("[RE_Control] Скрипт сброшен, вызов effects.reset_all()...")
    if success and effects and type(effects.reset_all) == "function" then
        pcall(effects.reset_all)
    end
end)
