import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Password hashes are stored as `scrypt$N$r$p$salt$hash` (salt and hash base64url), so the cost can be raised
// later without breaking existing hashes. Keep in sync with scripts/create-admin.mjs.
// Cost follows the OWASP recommendation for scrypt: N=2^17, r=8, p=1 (128 MiB, ~0.3 s).
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  const options: ScryptOptions = { N: n, r, p, maxmem: 256 * n * r * p };
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const cost = [Number(n), Number(r), Number(p)];
  // Refuse malformed or absurd parameters rather than letting a bad row exhaust memory.
  if (!cost.every(Number.isSafeInteger) || cost[0] > 2 ** 20 || cost[1] > 32 || cost[2] > 4) return false;
  try {
    const actual = await derive(password, Buffer.from(salt, "base64url"), cost[0], cost[1], cost[2]);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Verified against when the username does not exist, so a login takes as long either way
// and response time does not reveal which usernames exist.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}
