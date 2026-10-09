import { argon2, randomBytes, timingSafeEqual } from "node:crypto";

// argon2id natif de Node (≥ 24.7), paramètres OWASP.
const P = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };

const derive = (message: string, nonce: Buffer, p = P) =>
  new Promise<Buffer>((res, rej) => argon2("argon2id", { message, nonce, ...p }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `$argon2id$v=19$m=${P.memory},t=${P.passes},p=${P.parallelism}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  const m = hash.match(/^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/);
  if (!m) return false;
  const expected = Buffer.from(m[5], "base64");
  const key = await derive(password, Buffer.from(m[4], "base64"), {
    memory: +m[1], passes: +m[2], parallelism: +m[3], tagLength: expected.length,
  });
  return timingSafeEqual(key, expected);
}

// ponytail: courte liste locale des mots de passe les plus fuités ; brancher l'API k-anonymat HIBP si besoin.
const COMMON = new Set([
  "123456789012", "password1234", "motdepasse12", "azertyuiop12", "qwertyuiop12", "111111111111",
  "123123123123", "iloveyou1234", "admin1234567", "passwordpassword", "000000000000", "aaaaaaaaaaaa",
  "abcdefghijkl", "abc123abc123", "welcome12345", "letmein12345", "1234567890ab", "soleil123456",
]);
export const isCommonPassword = (pw: string) => COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw);
