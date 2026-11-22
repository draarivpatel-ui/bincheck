/**
 * Pure-JavaScript SHA-256 (FIPS 180-4) and HMAC-SHA-256 (RFC 2104).
 *
 * No DOM, no crypto APIs, no dependencies: the same implementation runs in the
 * browser tab and under the Node test runner, and is verified against the
 * published known-answer vectors in the self-test panel and the test suite.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

function rotr(word, bits) {
  return (word >>> bits) | (word << (32 - bits));
}

/** UTF-8 encodes a string without relying on TextEncoder (which browsers cap). */
export function utf8Bytes(text) {
  const input = String(text ?? "");
  const out = [];
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return Uint8Array.from(out);
}

/**
 * SHA-256 of a byte string. `input` may be a string (UTF-8 encoded), an array
 * of byte values, or a Uint8Array. Returns the digest as a Uint8Array of 32.
 */
export function sha256(input) {
  const bytes = typeof input === "string" ? utf8Bytes(input) : input instanceof Uint8Array ? input : Uint8Array.from(input);
  const bitLength = bytes.length * 8;

  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  // 64-bit big-endian bit length; JS bitwise ops are 32-bit so write hi/lo words.
  const hi = Math.floor(bitLength / 0x100000000);
  const lo = bitLength >>> 0;
  padded[paddedLength - 8] = (hi >>> 24) & 0xff;
  padded[paddedLength - 7] = (hi >>> 16) & 0xff;
  padded[paddedLength - 6] = (hi >>> 8) & 0xff;
  padded[paddedLength - 5] = hi & 0xff;
  padded[paddedLength - 4] = (lo >>> 24) & 0xff;
  padded[paddedLength - 3] = (lo >>> 16) & 0xff;
  padded[paddedLength - 2] = (lo >>> 8) & 0xff;
  padded[paddedLength - 1] = lo & 0xff;

  const state = new Uint32Array(INITIAL_STATE);
  const w = new Uint32Array(64);

  for (let block = 0; block < paddedLength; block += 64) {
    for (let t = 0; t < 16; t += 1) {
      const i = block + t * 4;
      w[t] = (padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3];
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];

    for (let t = 0; t < 64; t += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  for (let i = 0; i < 8; i += 1) {
    digest[i * 4] = (state[i] >>> 24) & 0xff;
    digest[i * 4 + 1] = (state[i] >>> 16) & 0xff;
    digest[i * 4 + 2] = (state[i] >>> 8) & 0xff;
    digest[i * 4 + 3] = state[i] & 0xff;
  }
  return digest;
}

export function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export function hexToBytes(hex) {
  const text = String(hex ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(text) || text.length % 2 !== 0) {
    return null;
  }
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function sha256Hex(input) {
  return bytesToHex(sha256(input));
}

/**
 * HMAC-SHA-256 (RFC 2104) over UTF-8 text. Key and message may be strings or
 * Uint8Array. Returns the lowercase hex tag.
 */
export function hmacSha256Hex(key, message) {
  const keyBytes = typeof key === "string" ? utf8Bytes(key) : key instanceof Uint8Array ? key : Uint8Array.from(key);
  const msgBytes = typeof message === "string" ? utf8Bytes(message) : message instanceof Uint8Array ? message : Uint8Array.from(message);

  const blockKey = keyBytes.length > 64 ? sha256(keyBytes) : keyBytes;
  const paddedKey = new Uint8Array(64);
  paddedKey.set(blockKey);

  const inner = new Uint8Array(64 + msgBytes.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i += 1) {
    inner[i] = paddedKey[i] ^ 0x36;
    outer[i] = paddedKey[i] ^ 0x5c;
  }
  inner.set(msgBytes, 64);
  const innerHash = sha256(inner);
  outer.set(innerHash, 64);
  return bytesToHex(sha256(outer));
}
