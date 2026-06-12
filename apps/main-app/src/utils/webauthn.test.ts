import { describe, it, expect } from 'vitest';
import { arrayBufferToBase64Url, base64UrlToArrayBuffer } from './webauthn';

describe('WebAuthn Base64Url Helpers', () => {
  it('should encode ArrayBuffer to Base64Url string correctly', () => {
    const str = 'Hello World?+/';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(str).buffer;

    const base64url = arrayBufferToBase64Url(buffer);

    expect(base64url).not.toContain('+');
    expect(base64url).not.toContain('/');
    expect(base64url).not.toContain('=');
    expect(base64url).toBe('SGVsbG8gV29ybGQ_Ky8');
  });

  it('should decode Base64Url string to ArrayBuffer correctly', () => {
    const base64url = 'SGVsbG8gV29ybGQ_Ky8';
    const buffer = base64UrlToArrayBuffer(base64url);

    const decoder = new TextDecoder();
    const decodedStr = decoder.decode(buffer);

    expect(decodedStr).toBe('Hello World?+/');
  });

  it('should roundtrip encode and decode correctly', () => {
    const originalBytes = new Uint8Array([0, 255, 127, 128, 64, 32, 16]);
    const base64url = arrayBufferToBase64Url(originalBytes.buffer);
    const decodedBuffer = base64UrlToArrayBuffer(base64url);
    const decodedBytes = new Uint8Array(decodedBuffer);

    expect(Array.from(decodedBytes)).toEqual(Array.from(originalBytes));
  });
});
