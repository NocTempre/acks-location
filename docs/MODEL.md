# Locations & Settlements — Design Model

How this module applies the family doctrine **reuse → extend → enhance →
invent**. It is the location-domain **binding target** of the table
extraction program (`acks-module-template/docs/CONTENT-EXTRACTION.md`): the
home of the settlement actor and of the per-world imported rules tables that
sibling modules (henchmen today; domains later) read through acks-lib.

- **Reuse**: the core `acks` system's actor framework and money/inventory
  documents; acks-lib's tables registry and service contracts (`requires
  acks-lib` — the module's only family edge).
- **Extend**:
  - Actor sub-type `acks-location.location` (TypeDataModel) — moved from
    acks-henchmen per the 2026-07-19 ruling (**no compatibility shims**):
    settlement identity, urban families / market class, demographics
    (culture weights), settlement alignment, market state.
  - **Table schemas**: typed shapes for the people/economy documents
    (cultures & names, occupations, age tables, class registry +
    distribution grids, wages, availability, followers, slavery, monstrous
    recruitment, settlement scale). The schemas ship; the **values never
    do**.
  - World-imported table documents, registered into `acksLib.tables` at
    priority 20 (world) via the lib's `ruledata-import` contract; the
    acks-content binding writes through that contract, never through this
    module's name.
- **Enhance**: the location sheet (market pools, demographics editor —
  migrating from henchmen in the consume phase); a "which tables are
  present / missing, and from which book" panel with import pointers.
- **Invent**: nothing the system provides. No book values, no fallback
  sample tables (ruling 1): absent tables render as stubs + citations.

## Decisions

- **2026-07-19 — founded as the extraction program's binding target.**
  Rulings recorded in CONTENT-EXTRACTION.md §4: no fallback samples; the
  location actor migrates here without migration shims; henchmen's shipped
  tables were purged the same day.
- **2026-07-19 — no sibling edges.** Consumers read `acksLib.tables`; this
  module registers into it. Neither side names the other (FAMILY.md §2
  discipline, adopted here from day one even though the wider refactor has
  not landed).
- Structures/strongholds extend this actor in a future module
  (acks-domains program); the "has X" inventory-marker fallback stays the
  interim contract.
