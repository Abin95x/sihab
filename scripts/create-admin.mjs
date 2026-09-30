// Creates an admin account, or sets a new password for an existing one (which signs it out everywhere).
// Usage: npm run admin:create -- <username>
// The password is asked for interactively. For non-interactive use (CI), set ADMIN_PASSWORD instead,
// and remove it from the environment afterwards: it is not needed at runtime.

import { randomBytes, scrypt } from "node:crypto";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

// Keep in sync with normalizeUsername() and the password limits in src/lib/validation.ts.
const USERNAME_RE = /^[a-z0-9._-]{3,64}$/;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 256;

// Keep in sync with hashPassword() in src/lib/password.ts.
const N = 2 ** 17;
const R = 8;
const P = 1;
function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 32, { N, r: R, p: P, maxmem: 256 * N * R * P }, (error, key) =>
      error
        ? reject(error)
        : resolve(`scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`),
    ),
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Reads a line from the terminal without echoing it. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
  });
}

if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set. Add it to .env first.");

const username = (process.argv[2] ?? process.env.ADMIN_USERNAME ?? "").normalize("NFKC").trim().toLowerCase();
if (!USERNAME_RE.test(username)) {
  fail("Usage: npm run admin:create -- <username>\nUsernames are 3–64 characters: letters, digits, dot, dash, underscore.");
}

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  if (!stdin.isTTY) fail("No terminal to ask for a password. Set ADMIN_PASSWORD instead.");
  password = await askHidden("New password: ");
  if ((await askHidden("Repeat password: ")) !== password) fail("The passwords don't match.");
}
if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
  fail(`The password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(
    `insert into admins (username, password_hash) values ($1, $2)
     on conflict (username) do update set password_hash = excluded.password_hash, updated_at = now()
     returning (xmax = 0) as created`,
    [username, await hashPassword(password)],
  );
  console.log(rows[0].created ? `Created admin "${username}".` : `Updated the password for "${username}".`);
  if (process.env.ADMIN_PASSWORD) console.log("You can now remove ADMIN_USERNAME and ADMIN_PASSWORD from .env.");
} catch (error) {
  console.error("Failed:", error.message);
  console.error("Have you created the tables with `npm run db:push`?");
  process.exitCode = 1;
} finally {
  await client.end();
}
