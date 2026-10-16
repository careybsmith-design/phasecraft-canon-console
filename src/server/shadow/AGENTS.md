# Shadow and exposure (Phase 7)

- Shadow/exposure rules are pure in `src/domain/shadow.ts`, mirrored in SQL (`thread_record_shadow_run`, `thread_authorize_exposure`, `thread_kill_switch`, `thread_record_incident`, `thread_record_value_measure`, migration 0023); change both together. Simulated evidence never promotes, authorises exposure or measures value (3.4). The kill switch's internal state change runs as the system actor; the Rollback keeps the human who pulled it.
