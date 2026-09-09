const fs = require('fs');
const path = require('path');

const ELECTRON_LOG = path.join(__dirname, '..', 're_control_system.log');
const GAME_LOG = 'E:\\Resident Evil 2\\re2_framework_log.txt';
const OUTPUT_LOG = path.join(__dirname, '..', 'live_debug.log');

console.log('====================================================');
console.log('🚀 RE:CONTROL LIVE AGENT MONITOR ACTIVATED');
console.log(`[MONITOR] Electron Log: ${ELECTRON_LOG}`);
console.log(`[MONITOR] Game Log:     ${GAME_LOG}`);
console.log(`[MONITOR] Unified Log:  ${OUTPUT_LOG}`);
console.log('====================================================\n');

// Clean start for unified debug log
fs.writeFileSync(OUTPUT_LOG, `=== RE:CONTROL LIVE MONITOR STARTED AT ${new Date().toISOString()} ===\n`);

function logEvent(source, level, message) {
  const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
  const line = `[${time}] [${source}] [${level}] ${message}`;
  
  if (level === 'ERROR' || level === 'CRIT') {
    console.error(`\x1b[31m${line}\x1b[0m`);
  } else if (level === 'WARN') {
    console.warn(`\x1b[33m${line}\x1b[0m`);
  } else if (level === 'SUCCESS' || level === 'LUA') {
    console.log(`\x1b[32m${line}\x1b[0m`);
  } else {
    console.log(line);
  }
  
  try {
    fs.appendFileSync(OUTPUT_LOG, line + '\n');
  } catch (e) {}
}

let electronOffset = 0;
let gameOffset = 0;

// Seek to current end of files so we only stream NEW events
try {
  if (fs.existsSync(ELECTRON_LOG)) {
    electronOffset = fs.statSync(ELECTRON_LOG).size;
    logEvent('SYSTEM', 'INFO', `Electron log initial offset: ${electronOffset} bytes`);
  }
} catch (e) {}

try {
  if (fs.existsSync(GAME_LOG)) {
    gameOffset = fs.statSync(GAME_LOG).size;
    logEvent('SYSTEM', 'INFO', `Game log initial offset: ${gameOffset} bytes`);
  }
} catch (e) {}

function pollFile(filePath, currentOffset, onLines) {
  try {
    if (!fs.existsSync(filePath)) return currentOffset;
    const stats = fs.statSync(filePath);
    if (stats.size < currentOffset) {
      currentOffset = 0;
    }
    if (stats.size > currentOffset) {
      const fd = fs.openSync(filePath, 'r');
      const length = stats.size - currentOffset;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, currentOffset);
      fs.closeSync(fd);
      
      const chunk = buffer.toString('utf8');
      const lines = chunk.split(/\r?\n/).filter(l => l.trim().length > 0);
      onLines(lines);
      return stats.size;
    }
  } catch (err) {}
  return currentOffset;
}

setInterval(() => {
  // 1. Poll Electron Log
  electronOffset = pollFile(ELECTRON_LOG, electronOffset, (lines) => {
    for (const line of lines) {
      let level = 'INFO';
      if (/\[ERROR\]/i.test(line) || /error/i.test(line) || /timeout/i.test(line)) level = 'ERROR';
      else if (/\[WARN\]/i.test(line)) level = 'WARN';
      logEvent('ELECTRON', level, line);
    }
  });

  // 2. Poll Game REFramework Log
  gameOffset = pollFile(GAME_LOG, gameOffset, (lines) => {
    for (const line of lines) {
      const isReControl = line.includes('[RE_Control]') || line.includes('effects.lua') || line.includes('recontrol_server');
      const isError = /error/i.test(line) || /exception/i.test(line) || /lua error/i.test(line);
      const isImportant = line.includes('REFramework initialized') || line.includes('Reset!') || line.includes('reframework');

      if (isReControl || isError || isImportant) {
        let level = isError ? 'ERROR' : (isReControl ? 'LUA' : 'GAME');
        logEvent('GAME_LUA', level, line);
      }
    }
  });
}, 300);

console.log('👀 Listening for events from RE:Control & Resident Evil 2...\n');
