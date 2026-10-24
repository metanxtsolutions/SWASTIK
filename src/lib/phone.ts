/**
 * Indian mobile numbers: 10 digits starting 6-9, optionally written with +91, 91 or 0.
 * Stored as the bare 10 digits.
 */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  const bare = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(bare) ? bare : null;
}

export function formatIndianMobile(bare: string): string {
  return bare.length === 10 ? `+91 ${bare.slice(0, 5)} ${bare.slice(5)}` : bare;
}

/** wa.me link for a configured business WhatsApp number (digits with country code). */
export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/[^\d]/g, "");
  if (digits.length < 10) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function maskPhone(bare: string): string {
  return bare.length === 10 ? `${bare.slice(0, 2)}xxxxxx${bare.slice(8)}` : "xxxx";
}
