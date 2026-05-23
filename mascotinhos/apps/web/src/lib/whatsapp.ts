/**
 * Builds a wa.me deep-link for the given phone number and pre-filled message.
 *
 * NEXT_PUBLIC_WHATSAPP_NUMBER may be stored with or without the Brazil country
 * code (55). We normalise here: strip a leading "55" if the number is longer
 * than 11 digits (DDD + 9-digit mobile), then always prefix with "55" so the
 * final URL is wa.me/55<DDD><number>.
 *
 * Examples:
 *   "11999998888"      → wa.me/5511999998888   ✓
 *   "5511999998888"    → wa.me/5511999998888   ✓ (was double-prefixed before)
 */
export function buildWhatsAppLink(phoneNumber: string, message: string): string {
  // Strip country code "55" prefix only when the number is clearly already
  // full international format (more than 11 digits = DDD + 9-digit number).
  const localNumber = phoneNumber.length > 11 && phoneNumber.startsWith("55")
    ? phoneNumber.slice(2)
    : phoneNumber;
  const encoded = encodeURIComponent(message);
  return `https://wa.me/55${localNumber}?text=${encoded}`;
}
