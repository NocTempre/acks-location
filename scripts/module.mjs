/**
 * acks-location — location primitives for the ACKS II module family.
 *
 * Scope: the `ruledata-import` provider (world-persisted rules tables
 * mirrored into acksLib.tables on every client) and the Ruledata Browser —
 * the GM's audit-and-tweak surface (export tables as prefilled Foundry
 * documents; drop a replacement to override at registry priority 30; revert
 * falls back to the import). The location actor type, table schemas, and
 * sheet migrate here from acks-henchmen in the consume phase — see
 * docs/MODEL.md and the template docs/CONTENT-EXTRACTION.md.
 */
import { MODULE_ID } from "./constants.mjs";
import { registerStoreSetting, registerPersisted, ruledataImport } from "./table-store.mjs";
import { RuledataBrowser, openRuledataBrowser } from "./ruledata-browser.mjs";

Hooks.once("init", () => {
  registerStoreSetting();

  const lib = globalThis.acksLib;
  if (!lib?.services || (lib.apiVersion ?? 0) < 3) {
    console.error(`${MODULE_ID} | acks-lib >= 0.7.0 (apiVersion 3) is required — table import disabled`);
    return;
  }
  lib.services.register("ruledata-import", ruledataImport);
  const n = registerPersisted();
  console.log(`${MODULE_ID} | ruledata-import provider ready (${n} persisted table layer(s) mirrored)`);

  game.settings.registerMenu(MODULE_ID, "ruledataBrowser", {
    name: "ACKS-LOCATION.browser.menuName",
    label: "ACKS-LOCATION.browser.menuLabel",
    hint: "ACKS-LOCATION.browser.menuHint",
    icon: "fas fa-table-list",
    type: RuledataBrowser,
    restricted: true,
  });
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = { openRuledataBrowser };
});
