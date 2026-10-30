// Native apps can't probe installed faces, and a named face that is missing falls
// back silently — so native offers the System option only. A face saved earlier
// still shows as a custom option (see resolveFontOptions).
export function isFontFamilyAvailable(_face: string): boolean {
  return false;
}
