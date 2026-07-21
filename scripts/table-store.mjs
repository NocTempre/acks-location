/**
 * The `ruledata-import` provider (acks-lib contract v1, see acks-lib
 * docs/API.md): persists imported rules-table documents as world data and
 * mirrors them into `acksLib.tables` on every client. Consumers (content
 * import flows) call the contract; sibling modules read the registry —
 * nobody names this module. No table values ship here (extraction-program
 * ruling 1): everything in the store arrived via a GM's own-book import.
 */
import { MODULE_ID } from "./constants.mjs";

const SETTING = "importedTables";

const lib = () => globalThis.acksLib;

/** Layers this client has mirrored into the registry, as "docId:priority". */
let _registered = new Set();

/** Mirror the persisted store into the lib registry; drop vanished layers. */
function syncRegistry(store) {
  const next = new Set();
  for (const entry of Object.values(store ?? {})) {
    if (!entry?.doc?.id) continue;
    try {
      lib().tables.registerTable(entry.doc, { priority: entry.priority, source: entry.source ?? MODULE_ID });
      next.add(`${entry.doc.id}:${entry.priority}`);
    } catch (err) {
      console.error(`${MODULE_ID} | failed to register persisted table "${entry.doc.id}"`, err);
    }
  }
  for (const key of _registered) {
    if (next.has(key)) continue;
    const cut = key.lastIndexOf(":");
    lib().tables.unregisterTable(key.slice(0, cut), { priority: Number(key.slice(cut + 1)) });
  }
  _registered = next;
  return next.size;
}

function readStore() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING) ?? {});
}

/** Register the world-scope store; onChange keeps every client mirrored. */
export function registerStoreSetting() {
  game.settings.register(MODULE_ID, SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: (value) => syncRegistry(value),
  });
}

/** Mirror whatever is already persisted (call once at init). */
export function registerPersisted() {
  return syncRegistry(readStore());
}

/** The contract implementation. Writes are GM-only; persistence triggers
 * the setting's onChange, which is what actually updates every registry. */
export const ruledataImport = {
  async importDoc(doc, { priority, source } = {}) {
    if (!game.user.isGM) throw new Error(`${MODULE_ID}: only a GM may import rules tables`);
    if (!doc?.id) throw new Error(`${MODULE_ID}: imported document must carry an id`);
    const p = priority ?? lib().tables.PRIORITY.WORLD;
    const store = readStore();
    store[`${doc.id}:${p}`] = { doc, priority: p, source: source ?? null, importedAt: Date.now() };
    await game.settings.set(MODULE_ID, SETTING, store);
    // Verify the write actually landed in world data. A world DB that loses
    // this write would silently un-import every table on the next reload —
    // fail loudly here instead (seen in the wild 2026-07-19).
    const persisted = game.settings.get(MODULE_ID, SETTING);
    if (!persisted?.[`${doc.id}:${p}`]) {
      ui.notifications.error(`acks-location | "${doc.id}" did not persist to world data — check the world's storage and re-import.`);
      throw new Error(`acks-location: persist verification failed for "${doc.id}"`);
    }
  },

  async removeDoc(docId, { priority } = {}) {
    if (!game.user.isGM) throw new Error(`${MODULE_ID}: only a GM may remove rules tables`);
    const p = priority ?? lib().tables.PRIORITY.WORLD;
    const store = readStore();
    delete store[`${docId}:${p}`];
    await game.settings.set(MODULE_ID, SETTING, store);
  },

  listDocs() {
    return Object.values(readStore())
      .map((e) => ({ id: e.doc?.id, priority: e.priority, source: e.source }))
      .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? "") || a.priority - b.priority);
  },
};
