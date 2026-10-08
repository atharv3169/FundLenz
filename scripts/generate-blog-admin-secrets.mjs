#!/usr/bin/env node
/**
 * OFFLINE admin setup. Run locally (not CI or ChatGPT).
 * Prompts for password without echoing characters, never stores plaintext on disk.
 * Prints a salted PBKDF2-SHA256 verifier and a separate random session secret.
 */
import { pbkdf2Sync, randomBytes } from "node:crypto";
const rounds = 600_000;
const b64url = value => Buffer.from(value).toString("base64url");

function hiddenPassword(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      reject(new Error("Run this in an interactive terminal; don't pipe your password through chat or a command."));
      return;
    }
    process.stdout.write(prompt);
    let typed = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const done = (value, error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = chunk => {
      for (const char of chunk) {
        if (char === "\u0003") { done("", new Error("Cancelled.")); return; }
        if (char === "\r" || char === "\n") { done(typed); return; }
        if (char === "\u007f" || char === "\b") { typed = typed.slice(0, -1); continue; }
        if (typed.length < 256) typed += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

try {
  console.log("FundLenz offline admin setup — password never leaves this computer.");
  const password = await hiddenPassword("Choose a unique password (12–256 characters): ");
  if (password.length < 12 || password.length > 256)
    throw new Error("Password must contain 12–256 characters. Nothing was generated.");
  const confirm = await hiddenPassword("Repeat the password: ");
  if (confirm !== password) throw new Error("Passwords did not match. Nothing was generated.");
  const salt = randomBytes(24);
  const hash = pbkdf2Sync(password, salt, rounds, 32, "sha256");
  const verifier = ["pbkdf2_sha256", rounds, b64url(salt), b64url(hash)].join("$");
  const sessionSecret = b64url(randomBytes(32));
  console.log("\nSave these separately as encrypted Cloudflare Worker secrets:");
  console.log("\nFUNDLENZ_ADMIN_PASSWORD_HASH\n" + verifier);
  console.log("\nFUNDLENZ_ADMIN_SESSION_SECRET\n" + sessionSecret);
  console.log("\nDo not send either value to chat or commit it to GitHub. Do not save terminal output into project files.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Setup failed.");
  process.exitCode = 1;
}
