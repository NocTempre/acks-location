# Changelog

## 0.2.1

- Add the `url` field to the manifest (GitHub repo link), matching the rest of
  the family.
- The init error for a missing/old acks-lib now names the real manifest floor
  (>= 0.8.0; the message claimed 0.7.0).
- Dev: restore the canonical `prepare` script (arms the pre-commit IP gate on
  clone) and rejoin the template's sync fleet — this repo had been omitted from
  DEFAULT_TARGETS, which is why toolchain-check failed on every push.

## 0.1.0

- Initial scaffold from acks-module-template.
