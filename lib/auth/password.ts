const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function fromBase64(value: string) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }

export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, material, 256);
  return { hash: toBase64(new Uint8Array(bits)), salt: toBase64(salt) };
}

export async function verifyPassword(password: string, salt: string, expected: string) {
  const actual = await hashPassword(password, fromBase64(salt));
  if (actual.hash.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.hash.length; i++) mismatch |= actual.hash.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export async function hashToken(token: string) {
  return toBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}
