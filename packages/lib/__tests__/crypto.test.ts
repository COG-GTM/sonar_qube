import { symmetricEncrypt, symmetricDecrypt } from "../crypto";

describe("crypto", () => {
  it("should encrypt and decrypt successfully", () => {
    const key = "a".repeat(32); // 32 byte key for AES-256
    const text = "test message";
    const encrypted = symmetricEncrypt(text, key);
    const decrypted = symmetricDecrypt(encrypted, key);
    expect(decrypted).toBe(text);
  });

  it("should use GCM mode and verify auth tag", () => {
    const key = "a".repeat(32);
    const text = "test message";
    const encrypted = symmetricEncrypt(text, key);
    // Tamper with ciphertext
    const parts = encrypted.split(":");
    parts[2] = parts[2].replace(/a/g, "b");
    const tampered = parts.join(":");
    expect(() => symmetricDecrypt(tampered, key)).toThrow();
  });

  it("should throw on invalid ciphertext format", () => {
    const key = "a".repeat(32);
    expect(() => symmetricDecrypt("invalid:format", key)).toThrow("Invalid ciphertext format");
  });
});
