---
name: __drop-in__
description: >
  Harness drop-in fixture. Not a product skill. Used by dropInSkill.selfcheck
  to prove a new Skills/ folder loads, gates tools, dispatches JobCompleted,
  and resumes via forceToolName with zero TypeScript changes.
allowed-tools:
  - read_file
  - write_file
  - run_command
  - transcribe_video
---

# Drop-in fixture

Internal contract skill. Do not offer it to users.
