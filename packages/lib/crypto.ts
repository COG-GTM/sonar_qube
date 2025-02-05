import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const INPUT_ENCODING = "utf8";
const OUTPUT_ENCODING = "hex";
const IV_LENGTH = 12; // GCM recommended IV length

export const symmetricEncrypt = function (text: string, key: string) {
  const _key = Buffer.from(key, "latin1");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, _key, iv);

  let ciphered = cipher.update(text, INPUT_ENCODING, OUTPUT_ENCODING);
  ciphered += cipher.final(OUTPUT_ENCODING);
  const authTag = cipher.getAuthTag();

  return `${iv.toString(OUTPUT_ENCODING)}:${authTag.toString(OUTPUT_ENCODING)}:${ciphered}`;
};

export const symmetricDecrypt = function (text: string, key: string) {
  const _key = Buffer.from(key, "latin1");
  const [ivHex, authTagHex, ...cipherParts] = text.split(":");

  const iv = Buffer.from(ivHex, OUTPUT_ENCODING);
  const authTag = Buffer.from(authTagHex, OUTPUT_ENCODING);
  const decipher = crypto.createDecipheriv(ALGORITHM, _key, iv);

  decipher.setAuthTag(authTag);
  let deciphered = decipher.update(cipherParts.join(":"), OUTPUT_ENCODING, INPUT_ENCODING);
  deciphered += decipher.final(INPUT_ENCODING);

  return deciphered;
};
