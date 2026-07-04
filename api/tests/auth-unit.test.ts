import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "../src/auth/password";
import { signToken, verifyToken } from "../src/auth/jwt";

describe("password hashing", () => {
  test("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  test("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("jwt", () => {
  test("signs a token that verifies back to the same user", async () => {
    const token = await signToken("user-123", "alice");
    const payload = await verifyToken(token);
    expect(payload.sub).toBe("user-123");
    expect(payload.username).toBe("alice");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test("rejects a tampered token", async () => {
    const token = await signToken("user-123", "alice");
    // Flip a character in the payload segment (not the very last character of
    // the signature, whose low bits can be base64 padding and not actually
    // change the decoded signature bytes).
    const parts = token.split(".");
    const mid = Math.floor(parts[1].length / 2);
    const flipped = parts[1][mid] === "a" ? "b" : "a";
    parts[1] = parts[1].slice(0, mid) + flipped + parts[1].slice(mid + 1);
    const tampered = parts.join(".");
    await expect(verifyToken(tampered)).rejects.toThrow();
  });
});
