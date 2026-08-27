import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import AdmZip from 'adm-zip';

/** Returns the path to bundled RE framework archives. */
function getFrameworksPath(): string {
  if (!app.isPackaged) {
    return path.join(process.cwd(), 're_frameworks');
  }
  return path.join(process.resourcesPath, 're_frameworks');
}

/** Returns the path to the bundled Lua scripts directory. */
function getLuaScriptsPath(): string {
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'lua_scripts');
  }
  return path.join(process.resourcesPath, 'lua_scripts');
}

/** Persistent config stored in userData as JSON. */
interface AppConfig {
  gamePath?: string;
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function saveConfig(data: Partial<AppConfig>): void {
  const configPath = getConfigPath();
  let existing: AppConfig = {};
  try {
    existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    // No existing config — start fresh
  }
  fs.writeFileSync(configPath, JSON.stringify({ ...existing, ...data }, null, 2), 'utf-8');
}

export class Installer {
  /**
   * Full install: unpack RE framework archive → copy Lua scripts → save config.
   */
  async install(options: {
    gamePath: string;
    archiveName: string;
    onProgress: (percent: number, message: string) => void;
  }): Promise<void> {
    const { gamePath, archiveName, onProgress } = options;

    // 10% — Verify game path
    onProgress(10, 'Проверка папки игры...');
    if (!fs.existsSync(gamePath)) {
      throw new Error(`Папка игры не найдена: ${gamePath}`);
    }

    // 20% — Backup existing dinput8.dll
    onProgress(20, 'Создание резервной копии...');
    const dinputPath = path.join(gamePath, 'dinput8.dll');
    const dinputBakPath = path.join(gamePath, 'dinput8.dll.bak');
    if (fs.existsSync(dinputPath)) {
      fs.renameSync(dinputPath, dinputBakPath);
    }

    // 40% — Open archive
    onProgress(40, 'Открытие архива...');
    const archivePath = path.join(getFrameworksPath(), archiveName);
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Архив не найден: ${archivePath}`);
    }
    const zip = new AdmZip(archivePath);

    // 80% — Extract
    onProgress(80, 'Распаковка файлов...');
    zip.extractAllTo(gamePath, /* overwrite */ true);

    // 90% — Copy Lua scripts
    onProgress(90, 'Копирование Lua-скриптов...');
    await this._copyLuaScripts(gamePath);

    // 100% — Save config
    onProgress(100, 'Установка завершена!');
    saveConfig({ gamePath });
  }

  /**
   * Re-copies only the Lua scripts without reinstalling the framework.
   */
  async updateScripts(
    gamePath: string,
    onProgress: (percent: number, message: string) => void
  ): Promise<void> {
    onProgress(10, 'Обновление скриптов...');
    if (!fs.existsSync(gamePath)) {
      throw new Error(`Папка игры не найдена: ${gamePath}`);
    }
    onProgress(50, 'Копирование Lua-скриптов...');
    await this._copyLuaScripts(gamePath);
    onProgress(100, 'Скрипты обновлены!');
  }

  // ---------------------------------------------------------------------------

  private async _copyLuaScripts(gamePath: string): Promise<void> {
    const luaDir = getLuaScriptsPath();
    const destDir = path.join(gamePath, 'reframework', 'autorun');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const scripts = ['recontrol_server.lua', 'effects.lua'];
    for (const script of scripts) {
      const src = path.join(luaDir, script);
      const dest = path.join(destDir, script);
      if (!fs.existsSync(src)) {
        throw new Error(`Lua-скрипт не найден: ${src}`);
      }
      fs.copyFileSync(src, dest);
    }
  }
}
