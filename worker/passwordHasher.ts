import { DurableObject } from "cloudflare:workers";
import { createHmac, pbkdf2Sync } from "node:crypto";
import type { Env } from "./http";

// Keep password derivation within the Durable Object's CPU budget.
export class PasswordHasher extends DurableObject<Env> {
  hash(password: string, salt: string) {
    const pepper = this.env.PASSWORD_PEPPER;
    if (!pepper || pepper.length < 32) throw new Error("Password hashing is not configured");
    const secret = createHmac("sha256", pepper).update(password, "utf8").digest();
    return pbkdf2Sync(secret, salt, 600_000, 32, "sha256").toString("hex");
  }
}
