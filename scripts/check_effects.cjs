// Verify that every effect id in the shared registry exists in lua_scripts/effects.lua
// and that the Lua module has no effect functions missing from the registry.
//
// Aliases are respected: `Effects.empty_mag = Effects.empty_ammo` means either id
// covers the other (the registry may expose only one of them).
//
// Run: npm run check:effects

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const registryPath = path.join(root, 'src', 'shared', 'effects-registry.ts');
const luaPath = path.join(root, 'lua_scripts', 'effects.lua');

const registrySrc = fs.readFileSync(registryPath, 'utf8');
const luaSrc = fs.readFileSync(luaPath, 'utf8');

// ids declared in the registry: { id: '...' }
const ids = [...registrySrc.matchAll(/\{\s*id:\s*'([a-z0-9_]+)'/g)].map(m => m[1]);

// primary functions implemented in Lua
const luaFuncs = new Set(
    [...luaSrc.matchAll(/function Effects\.([a-z0-9_]+)\s*\(/g)].map(m => m[1])
);

// aliases: Effects.<alias> = Effects.<target>
const aliasGroups = [];
for (const m of luaSrc.matchAll(/^Effects\.([a-z0-9_]+)\s*=\s*Effects\.([a-z0-9_]+)/gm)) {
    luaFuncs.add(m[1]);
    aliasGroups.push([m[1], m[2]]);
}

// Union-Find over alias groups so heal_small/light_heal/green_herb count as one effect
const parent = new Map();
const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x);
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
};
const union = (a, b) => parent.set(find(a), find(b));
for (const [a, b] of aliasGroups) union(a, b);

const covered = (name) => {
    const r = find(name);
    return ids.some(id => find(id) === r);
};

const missingInLua = ids.filter(id => !luaFuncs.has(id) && ![...luaFuncs].some(f => find(f) === find(id)));
const missingInRegistry = [...luaFuncs].filter(f => !covered(f));

let failed = false;

if (missingInLua.length) {
    failed = true;
    console.error('✖ Registry ids with no Lua implementation:');
    for (const id of missingInLua) console.error('   - ' + id);
}

if (missingInRegistry.length) {
    failed = true;
    console.error('✖ Lua functions missing from the registry:');
    for (const id of missingInRegistry) console.error('   - ' + id);
}

if (failed) {
    console.error('\nEffects registry drift detected. Sync src/shared/effects-registry.ts and lua_scripts/effects.lua.');
    process.exit(1);
}

console.log(`✔ Effects registry in sync: ${ids.length} registry ids, ${luaFuncs.size} Lua functions (aliases resolved).`);