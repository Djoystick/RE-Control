# GLOBAL AGENT PROTOCOL: STRICT DELEGATION

**ROLE RESTRICTION:**
Antigravity (The Root Agent) is EXPLICITLY FORBIDDEN from writing, modifying, or injecting code into this project.

**DELEGATION MATRIX:**
- Frontend (React/Vite/Tailwind) & Backend (Electron/Node): MUST be delegated to subagent ree-claude-code.
- Game Engine (Lua/REFramework): MUST be delegated to OpenRouter via scripts/openrouter_worker.js.

**PROCEDURE:**
1. Analyze user request.
2. Formulate the architecture.
3. Spawn the respective agent (invoke_subagent or un_command node script).
4. Wait for the agent to finish.
5. Review the result.
