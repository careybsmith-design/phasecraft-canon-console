import { independentlyVerified } from "./hardening";
export interface VerificationRecord {
  id: string; compliance_scoped: boolean; code_route: string; test_route: string;
  implementation_visible: boolean; human_reviewed: boolean; provenance: string;
  confirmed_behavior_ref: string | null; outcome_contract_ref: string | null;
  mutation_sample_passed: boolean; cycle_reviewed: boolean;
}
export function verificationIndependence(records: VerificationRecord[]) {
  const independent = (r: VerificationRecord) => independentlyVerified(r) && Boolean(r.confirmed_behavior_ref && r.outcome_contract_ref) && r.mutation_sample_passed && r.cycle_reviewed;
  const compliance = records.filter(r => r.compliance_scoped);
  const allCount = records.filter(independent).length; const complianceCount = compliance.filter(independent).length;
  const overall_pct = records.length ? 100 * allCount / records.length : null;
  const compliance_pct = compliance.length ? 100 * complianceCount / compliance.length : null;
  return { overall_pct, compliance_pct, overall_target: 70, compliance_target: 100, total: records.length, independent: allCount, compliance_total: compliance.length, compliance_independent: complianceCount,
    pass: overall_pct !== null && overall_pct >= 70 && compliance_pct !== null && compliance_pct === 100,
    evidence: records.map(r => ({ id: r.id, independent: independent(r), compliance_scoped: r.compliance_scoped })) };
}