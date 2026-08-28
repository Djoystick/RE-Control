local success, effects = pcall(require, "effects")

log.info("[RE_Control] Запуск File Bridge...")

re.on_frame(function()
    local cmd_raw = fs.read("RE_Control_in.txt")
    
    if cmd_raw and cmd_raw ~= "" then
        fs.write("RE_Control_in.txt", "")
        cmd_raw = cmd_raw:gsub("^%s*(.-)%s*$", "%1")
        
        local response = "UNKNOWN_COMMAND"
        
        if success and effects[cmd_raw] then
            local exec_success, err = pcall(effects[cmd_raw])
            if exec_success then
                response = "SUCCESS"
            else
                log.error("[RE_Control] Ошибка: " .. tostring(err))
                response = "ERROR"
            end
        end
        
        fs.write("RE_Control_out.txt", response)
    end
end)


