import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { dialog } from 'electron';

/**
 * GameFinder — locates installed game directories via Steam registry,
 * VDF library parsing, disk scan fallback, or manual browse.
 */
export class GameFinder {
  /**
   * Attempts to find the game directory automatically.
   * Priority:
   *   1. Steam registry → libraryfolders.vdf → steamapps/common
   *   2. Disk scan (C, D, E, F) — first-level folders only
   *   3. Returns null if not found
   */
  async findGame(_steamAppId: string, exeName: string): Promise<string | null> {
    try {
      const steamPath = await this._getSteamPath();
      if (steamPath) {
        const libraries = await this._getLibraryPaths(steamPath);
        for (const lib of libraries) {
          const found = await this._searchLibrary(lib, exeName);
          if (found) return found;
        }
      }
    } catch {
      // Steam not available — fall through to disk scan
    }

    // Fallback: scan top-level folders on common drives
    return this._diskScan(exeName);
  }

  /**
   * Opens a native file dialog to let the user locate the game .exe.
   * Returns the directory containing the selected .exe, or null if cancelled.
   */
  async browseForGame(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Выберите .exe файл игры',
      filters: [{ name: 'Executable', extensions: ['exe'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return path.dirname(result.filePaths[0]);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Reads SteamPath from the Windows registry via PowerShell. */
  private _getSteamPath(): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '(Get-ItemProperty "HKCU:\\Software\\Valve\\Steam" -Name SteamPath).SteamPath'
        ],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) return reject(err);
          const trimmed = stdout.trim();
          if (!trimmed) return reject(new Error('SteamPath is empty'));
          resolve(trimmed);
        }
      );
    });
  }

  /** Parses libraryfolders.vdf and returns all library root paths. */
  private _getLibraryPaths(steamPath: string): string[] {
    const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdfPath)) return [steamPath];

    const content = fs.readFileSync(vdfPath, 'utf-8');
    // Match "path"  "C:\\Games\\Steam" style entries
    const regex = /"path"\s+"([^"]+)"/gi;
    const paths: string[] = [steamPath];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      paths.push(match[1].replace(/\\\\/g, '\\'));
    }
    return paths;
  }

  /** Searches steamapps/common within a given library for the exe. */
  private _searchLibrary(libraryPath: string, exeName: string): string | null {
    const commonPath = path.join(libraryPath, 'steamapps', 'common');
    if (!fs.existsSync(commonPath)) return null;

    try {
      const gameDirs = fs.readdirSync(commonPath, { withFileTypes: true });
      for (const dir of gameDirs) {
        if (!dir.isDirectory()) continue;
        const candidate = path.join(commonPath, dir.name, exeName);
        if (fs.existsSync(candidate)) {
          return path.join(commonPath, dir.name);
        }
      }
    } catch {
      // Ignore read errors for individual entries
    }
    return null;
  }

  /** Scans top-level directories on drives C–F for the exe. */
  private _diskScan(exeName: string): string | null {
    const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\'];
    for (const drive of drives) {
      if (!fs.existsSync(drive)) continue;
      try {
        const entries = fs.readdirSync(drive, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const candidate = path.join(drive, entry.name, exeName);
          if (fs.existsSync(candidate)) {
            return path.join(drive, entry.name);
          }
        }
      } catch {
        // No permission or inaccessible — skip
      }
    }
    return null;
  }
}
