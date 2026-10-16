# Creation loop (Phase 6)

- Prompt compilation is pure in `src/domain/creation.ts` and reads only typed fields; `creation_prompt_raw_guard` re-checks every stored prompt against the sources' captured text and hash. Why: Part 13.4 enforced twice, not by convention.
- Every write goes through `thread_compile_creation_prompt`, `thread_dispatch_build`, `thread_record_build_result`, `thread_record_skeleton`, `thread_record_iteration`, `thread_set_cost_ceiling` (service role only). `build_runs_guard` enforces platform clearance, the full reproducibility key, per-build/mission/cell ceilings and pinned fields. Why: ceilings at dispatch (13.5), lineage by system.
- The database records the run BEFORE the adapter is called, so nothing leaves THREAD unchecked.
- Platform registry: `PLATFORM_REGISTRY` mirrors the `build_platforms` seed; `detectChangeClass` mirrors `_classify_iteration`; the simulated digest mirrors `_sim_build_digest`. Change both together.
- Adapter choice: `adapter_bindings` BuildPlatform=live AND `BUILD_PLATFORM_<P>_URL/_TOKEN` set, else simulated. Live results return via `/api/public/hooks/build/$platform` signed with `BUILD_WEBHOOK_SECRET_<P>`.
