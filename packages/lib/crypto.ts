import crypto from "crypto";

const ALGORITHM = "aes-256-gcm"; // Using GCM mode for authenticated encryption
const INPUT_ENCODING = "utf8";
const OUTPUT_ENCODING = "hex";
const IV_LENGTH = 12; // 96 bits for GCM mode
const AUTH_TAG_LENGTH = 16; // 128 bits authentication tag

/**
 *
 * @param text Value to be encrypted
 * @param key Key used to encrypt value must be 32 bytes for AES256 encryption algorithm
 *
 * @returns Encrypted value using key with authentication tag
 */
export const symmetricEncrypt = function (text: string, key: string) {
  const _key = Buffer.from(key, "latin1");
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, _key, iv);
  let ciphered = cipher.update(text, INPUT_ENCODING, OUTPUT_ENCODING);
  ciphered += cipher.final(OUTPUT_ENCODING);
  const authTag = cipher.getAuthTag();
  // Store IV, auth tag, and ciphertext
  const ciphertext = `${iv.toString(OUTPUT_ENCODING)}:${authTag.toString(OUTPUT_ENCODING)}:${ciphered}`;

  return ciphertext;
};

/**
 *
 * @param text Value to decrypt
 * @param key Key used to decrypt value must be 32 bytes for AES256 encryption algorithm
 */
export const symmetricDecrypt = function (text: string, key: string) {
  const _key = Buffer.from(key, "latin1");

  const components = text.split(":");
  if (components.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }

  const [ivHex, authTagHex, encryptedHex] = components;
  const iv = Buffer.from(ivHex, OUTPUT_ENCODING);
  const authTag = Buffer.from(authTagHex, OUTPUT_ENCODING);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, _key, iv);
  decipher.setAuthTag(authTag);
  let deciphered = decipher.update(encryptedHex, OUTPUT_ENCODING, INPUT_ENCODING);
  deciphered += decipher.final(INPUT_ENCODING);

  return deciphered;
};
