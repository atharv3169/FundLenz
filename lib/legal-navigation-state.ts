export const LEGAL_SOURCE_KEY = "fundlenz:legal-return-source:v1";
export const LEGAL_LAB_KEY = "fundlenz:legal-return-lab:v1";
export const LEGAL_CAPTURE_EVENT = "fundlenz:legal-navigation-capture";
const TTL = 2 * 60 * 60 * 1000;
type LegalSource = { from: string; to: "/privacy" | "/terms"; at: number };
export function isInternalRoute(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") &&
    !path.startsWith("//") && !path.includes("\\") && path.length < 4096;
}
export function validLegalSource(value: unknown, legalPath: string, now = Date.now()): value is LegalSource {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LegalSource>;
  return isInternalRoute(v.from) && v.from !== legalPath &&
    (v.to === "/privacy" || v.to === "/terms") && v.to === legalPath &&
    typeof v.at === "number" && Number.isFinite(v.at) &&
    v.at <= now && now - v.at <= TTL;
}
