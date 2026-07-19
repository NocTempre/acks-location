/**
 * acks-location — location primitives for the ACKS II module family.
 *
 * v0.1 scope: the `ruledata-import` provider (world-persisted rules tables
 * mirrored into acksLib.tables on every client). The location actor type,
 * table schemas, and sheet migrate here from acks-henchmen in the consume
 * phase — see docs/MODEL.md and the template docs/CONTENT-EXTRACTION.md.
 */
import { MODULE_ID } from "./constants.mjs";
import { registerStoreSetting, registerPersisted, ruledataImport } from "./table-store.mjs";

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
});
