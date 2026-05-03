export async function hashPassword(plain) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(plain)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isHashed(pw) {
  return typeof pw === 'string' && pw.length === 64 && /^[0-9a-f]+$/.test(pw);
}
