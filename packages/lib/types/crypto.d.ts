/// <reference types="node" />

declare module "crypto" {
  import type { Buffer } from "buffer";

  interface Cipher {
    getAuthTag(): Buffer;
    update(data: string, inputEncoding: string, outputEncoding: string): string;
    final(outputEncoding: string): string;
  }

  interface Decipher {
    setAuthTag(tag: Buffer): void;
    update(data: string, inputEncoding: string, outputEncoding: string): string;
    final(inputEncoding: string): string;
  }

  export function createCipheriv(algorithm: string, key: Buffer, iv: Buffer): Cipher;
  export function createDecipheriv(algorithm: string, key: Buffer, iv: Buffer): Decipher;
  export function randomBytes(size: number): Buffer;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CALENDSO_ENCRYPTION_KEY: string;
    }
  }
}
