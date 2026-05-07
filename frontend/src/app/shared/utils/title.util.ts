export function splitTitleAtLastColon(
  title: string | null | undefined,
): { prefix: string; main: string } {
  if (!title) return { prefix: '', main: '' };

  const segments = title
    .split(':')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) return { prefix: '', main: segments[0] ?? '' };

  const main = segments.pop()!;
  // Drop bare "Other" segments (the canonical "Other:" prefix gives no info
  // beyond the OTHERS hazard type already shown elsewhere), then strip the
  // ", please specify" wording from any remaining prefix segments so it
  // doesn't surface in the UI.
  const prefix = segments
    .filter((s) => s.toLowerCase() !== 'other')
    .map((s) => s.replace(/,\s*please\s+specify/gi, '').trim())
    .filter(Boolean)
    .join(': ');
  return { prefix, main };
}
