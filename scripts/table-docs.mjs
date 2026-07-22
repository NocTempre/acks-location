/* global game, foundry, CONST, RollTable, JournalEntry, Folder, fromUuid */
/**
 * Imported tables ⇄ Foundry documents.
 *
 * Every imported ruledata table can be EXPORTED as a world document
 * (prefilled with the imported default) for audit and tweaking, and a world
 * document can be dropped back to OVERRIDE the table (registry priority 30,
 * above world imports — see acks-lib tables.mjs). Two shapes:
 *
 *  - ROLLABLE tables (a single d-range → entry list) round-trip through a
 *    native RollTable — tweak weights/entries in the RollTable UI.
 *  - Everything else (grids, ladders, prose values) round-trips through a
 *    JournalEntry page holding pretty-printed JSON in a code block.
 *
 * No table values ship in this module: exports read whatever the WORLD
 * imported from the GM's own books.
 */
import { MODULE_ID } from "./constants.mjs";

const FOLDER_NAME = "ACKS Imported Tables";
const JOURNAL_NAME = "ACKS Ruledata (Imported)";

const lib = () => globalThis.acksLib;

/* ------------------------- entry enumeration ------------------------- */

/**
 * Flatten the registry into browser entries. occupationSubTables expands
 * into one entry per category (each category IS one d100 list).
 * @returns {{docId,tableId,subId,key,label,rollable}[]}
 */
export function listEntries() {
  const t = lib()?.tables;
  if (!t) return [];
  const out = [];
  for (const { id: docId, priority } of t.docInfo()) {
    if (priority !== t.PRIORITY.WORLD) continue; // enumerate what imports provided
    let doc;
    try {
      doc = t.getDoc(docId);
    } catch {
      continue;
    }
    for (const [tableId, data] of Object.entries(doc.tables ?? {})) {
      if (tableId === "occupationSubTables" && data?.categories) {
        for (const subId of Object.keys(data.categories)) {
          out.push(entryOf(docId, tableId, subId));
        }
        continue;
      }
      out.push(entryOf(docId, tableId, null));
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function entryOf(docId, tableId, subId) {
  const key = subId ? `${docId}.${tableId}.${subId}` : `${docId}.${tableId}`;
  return { docId, tableId, subId, key, label: key, rollable: isRollable(docId, tableId, subId) };
}

/** Current EFFECTIVE data for an entry (override layer included). */
export function entryData({ docId, tableId, subId }) {
  const data = lib().tables.getTable(docId, tableId);
  return subId ? data?.categories?.[subId] : data;
}

/* ------------------------- rollable kinds ------------------------- */

/**
 * A table is rollable when its data is one (range|weight) → text list:
 *  - occupationSubTables categories: d100 rows {min,max,occupation,special?}
 *  - dwarvenCastes: caste → percentage weights (remainder caste = null)
 *  - randomHenchmanLevel: d20 bands {min,max,level}
 */
export function isRollable(docId, tableId, subId) {
  if (subId != null) return tableId === "occupationSubTables";
  return (docId === "people" && tableId === "dwarvenCastes") || (docId === "rarity" && tableId === "randomHenchmanLevel");
}

function rollTableSpec(entry, data) {
  const { docId, tableId } = entry;
  if (entry.subId) {
    const rows = data?.rows ?? [];
    return {
      formula: "1d100",
      results: rows.map((r) => ({
        range: [r.min ?? 1, r.max ?? r.min ?? 100],
        text: r.special ? `${r.occupation} — ${r.special}` : r.occupation,
      })),
    };
  }
  if (docId === "people" && tableId === "dwarvenCastes") {
    const order = data.order ?? Object.keys(data.labels ?? {});
    const known = order.map((id) => data[`${id}Pct`]).filter((v) => typeof v === "number");
    const remainder = Math.max(0, 100 - known.reduce((a, b) => a + b, 0));
    let at = 0;
    return {
      formula: "1d100",
      results: order.map((id) => {
        const w = typeof data[`${id}Pct`] === "number" ? data[`${id}Pct`] : remainder;
        const range = [at + 1, at + Math.max(1, w)];
        at += Math.max(1, w);
        return { range, text: data.labels?.[id] ?? id };
      }),
    };
  }
  if (docId === "rarity" && tableId === "randomHenchmanLevel") {
    return {
      formula: "1d20",
      results: (data.rows ?? []).map((r) => ({
        range: [r.min ?? 1, r.max ?? 20],
        text: `Level ${r.level}`,
      })),
    };
  }
  return null;
}

/** Parse a RollTable back into the entry's ruledata shape. */
function parseRollTable(entry, table) {
  const results = [...table.results].sort((a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0));
  const textOf = (r) => String(r.description ?? r.text ?? "").trim();
  if (entry.subId) {
    const rows = results.map((r) => {
      const [min, max] = r.range ?? [1, 100];
      const [occupation, ...rest] = textOf(r).split(" — ");
      const row = { min, max, occupation: occupation.trim() };
      if (rest.length) row.special = rest.join(" — ").trim();
      return row;
    });
    // whole-table override: replace this category, keep the others as-is
    const current = lib().tables.getTable(entry.docId, entry.tableId);
    return { categories: { ...(current?.categories ?? {}), [entry.subId]: { rows } } };
  }
  if (entry.docId === "people" && entry.tableId === "dwarvenCastes") {
    const current = lib().tables.getTable(entry.docId, entry.tableId);
    const labelToId = Object.fromEntries(Object.entries(current.labels ?? {}).map(([id, l]) => [String(l).toLowerCase(), id]));
    const out = { ...current };
    const order = [];
    let total = 0;
    for (const r of results) {
      const [min, max] = r.range ?? [0, 0];
      total += Math.max(0, max - min + 1);
    }
    for (const r of results) {
      const label = textOf(r);
      const id = labelToId[label.toLowerCase()] ?? label.toLowerCase().replace(/[^a-z0-9]/g, "");
      const [min, max] = r.range ?? [0, 0];
      const w = Math.max(0, max - min + 1);
      out[`${id}Pct`] = total > 0 ? Math.round((w * 100) / total) : 0;
      out.labels = { ...(out.labels ?? {}), [id]: label };
      order.push(id);
    }
    out.order = order;
    return out;
  }
  if (entry.docId === "rarity" && entry.tableId === "randomHenchmanLevel") {
    const rows = results.map((r) => {
      const [min, max] = r.range ?? [1, 20];
      const level = Number(textOf(r).match(/\d+/)?.[0] ?? 0);
      return { min, max, level };
    });
    return { rows };
  }
  throw new Error(`not a rollable entry: ${entry.key}`);
}

/* ------------------------- journal round-trip ------------------------- */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function jsonPageContent(data) {
  return `<pre><code>${esc(JSON.stringify(data, null, 2))}</code></pre>`;
}

export function parseJsonContent(html) {
  const m = String(html).match(/<code[^>]*>([\s\S]*?)<\/code>/);
  const raw = (m ? m[1] : String(html))
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
  return JSON.parse(raw.trim());
}

/* ------------------------- export ------------------------- */

async function ensureFolder() {
  return (
    game.folders.find((f) => f.type === "RollTable" && f.name === FOLDER_NAME) ??
    (await Folder.create({ name: FOLDER_NAME, type: "RollTable" }))
  );
}

async function ensureJournal() {
  return (
    game.journal.find((j) => j.name === JOURNAL_NAME) ?? (await JournalEntry.create({ name: JOURNAL_NAME }))
  );
}

/**
 * Materialize an entry as a world document PREFILLED with its current
 * effective data. Re-export updates the same document.
 * @returns {{uuid: string, kind: "rolltable"|"journal"}}
 */
export async function exportEntry(entry) {
  const data = entryData(entry);
  if (entry.rollable) {
    const spec = rollTableSpec(entry, data);
    const folder = await ensureFolder();
    const existing = game.tables.find((t) => t.name === entry.key);
    if (existing) {
      await existing.deleteEmbeddedDocuments("TableResult", existing.results.map((r) => r.id));
      await existing.createEmbeddedDocuments("TableResult", spec.results);
      await existing.update({ formula: spec.formula });
      return { uuid: existing.uuid, kind: "rolltable" };
    }
    const table = await RollTable.create({
      name: entry.key,
      folder: folder.id,
      formula: spec.formula,
      description: game.i18n.format("ACKS-LOCATION.tables.exportedFrom", { key: entry.key }),
      results: spec.results,
    });
    return { uuid: table.uuid, kind: "rolltable" };
  }
  const journal = await ensureJournal();
  const content = jsonPageContent(data);
  const page = journal.pages.find((p) => p.name === entry.key);
  if (page) {
    await page.update({ "text.content": content });
    return { uuid: page.uuid, kind: "journal" };
  }
  const [created] = await journal.createEmbeddedDocuments("JournalEntryPage", [
    { name: entry.key, type: "text", text: { content, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1 } },
  ]);
  return { uuid: created.uuid, kind: "journal" };
}

/* ------------------------- override via drop ------------------------- */

/**
 * Parse a dropped document into the entry's ruledata shape.
 * Accepts a RollTable (rollable entries) or a JournalEntry/Page whose code
 * block carries JSON (any entry).
 */
export async function parseDrop(entry, dropData) {
  const doc = await fromUuid(dropData?.uuid ?? "");
  if (!doc) throw new Error("drop: document not found");
  const type = doc.documentName;
  if (type === "RollTable") {
    if (!entry.rollable) throw new Error(game.i18n.localize("ACKS-LOCATION.tables.notRollable"));
    return { data: parseRollTable(entry, doc), sourceUuid: doc.uuid, sourceName: doc.name };
  }
  if (type === "JournalEntryPage") {
    return { data: reshapeJson(entry, parseJsonContent(doc.text?.content ?? "")), sourceUuid: doc.uuid, sourceName: doc.name };
  }
  if (type === "JournalEntry") {
    const page = doc.pages.find((p) => p.name === entry.key) ?? doc.pages.find((p) => p.type === "text");
    if (!page) throw new Error("drop: journal has no text page");
    return { data: reshapeJson(entry, parseJsonContent(page.text?.content ?? "")), sourceUuid: page.uuid, sourceName: page.name };
  }
  throw new Error(game.i18n.format("ACKS-LOCATION.tables.badDropType", { type }));
}

/** JSON drops for a sub-table entry carry just that category. */
function reshapeJson(entry, parsed) {
  if (!entry.subId) return parsed;
  const current = lib().tables.getTable(entry.docId, entry.tableId);
  const category = parsed?.categories ? parsed.categories[entry.subId] : parsed;
  return { categories: { ...(current?.categories ?? {}), [entry.subId]: category } };
}
