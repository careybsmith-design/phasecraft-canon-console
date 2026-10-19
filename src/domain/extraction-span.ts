/** L-06 candidate validation before any persistence; SQL validates the same range forms. */
export function validExtractionSpan(span: unknown): boolean {
  if (!span || typeof span !== "object") return false;
  const s = span as Record<string, unknown>;
  if (s["kind"] === "region") {
    if (
      !Array.isArray(s["start"]) ||
      !Array.isArray(s["end"]) ||
      s["start"].length !== 2 ||
      s["end"].length !== 2
    )
      return false;
    const [x, y] = s["start"];
    const [right, bottom] = s["end"];
    return (
      [x, y, right, bottom].every(
        (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1,
      ) &&
      right > x &&
      bottom > y
    );
  }
  return (
    ["time_range", "char_range", "log_offset"].includes(String(s["kind"])) &&
    typeof s["start"] === "number" &&
    typeof s["end"] === "number" &&
    Number.isInteger(s["start"]) &&
    Number.isInteger(s["end"]) &&
    s["start"] >= 0 &&
    s["end"] > s["start"]
  );
}
