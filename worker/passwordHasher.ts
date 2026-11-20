import { DurableObject } from "cloudflare:workers";
import { createHmac } from "node:crypto";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { Env } from "./http";

// Keep password derivation within the Durable Object's CPU budget.
export class PasswordHasher extends DurableObject<Env> {
  hash(password: string, salt: string) {
    const pepper = this.env.PASSWORD_PEPPER;
    if (!pepper || pepper.length < 32) throw new Error("Password hashing is not configured");
    const secret = createHmac("sha256", pepper).update(password, "utf8").digest();
    // The hosted runtime caps native PBKDF2 at 100,000 iterations.
    return bytesToHex(pbkdf2(sha256, secret, salt, { c: 600_000, dkLen: 32 }));
  }
}
