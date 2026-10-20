// TEST MODE — build-phase convenience, authorised by the app owner (2026-10-20).
//
// While TEST_MODE is true the sign-in gate is lifted: every browser receives a
// disposable anonymous session behind the scenes, so records still carry a
// verified actor and the audit/provenance design stays intact. The banner on
// every page marks the build as "Test mode — authentication disabled".
//
// To restore normal authentication before release:
//   1. Set TEST_MODE to false (this file) — the sign-in gate and /auth page
//      return unchanged; no other code changes are needed.
//   2. Turn anonymous sign-ins back off in the backend auth settings.
//   3. Delete the disposable test accounts it created (auth users flagged
//      is_anonymous = true) and their build-test rows once they are no longer
//      needed.
export const TEST_MODE = true;

// A test-mode grant may only ever touch a session whose token is flagged
// anonymous. Real (email/Google) accounts never pass this predicate, so the
// steward grant below is unreachable for them.
export function isTestEligible(claims: Record<string, unknown> | null | undefined): boolean {
  return claims?.["is_anonymous"] === true;
}
