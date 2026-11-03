const BYTE_SLOTS = 4;
const BYTE_PAD = 256;
const HASH_BUCKETS = 2048;
// The largest codepoint times this stays below 2^53, so the product is exact.
const HASH_MULTIPLIER = 2654435761;

export type EncodedText = {
  /** UTF-8 byte ids per codepoint, flattened from `[characters, 4]`. */
  readonly bytes: BigInt64Array;
  /** One hash per codepoint, in `[1, 2047]`. */
  readonly hashes: BigInt64Array;
};

const utf8 = new TextEncoder();

const byteSlots = (codepoint: string): readonly bigint[] => {
  const raw = utf8.encode(codepoint);
  return Array.from({ length: BYTE_SLOTS }, (_, slot) =>
    BigInt(raw[slot] ?? BYTE_PAD),
  );
};

const hash = (codepoint: string): bigint =>
  BigInt(
    1 + ((codepoint.codePointAt(0)! * HASH_MULTIPLIER) % (HASH_BUCKETS - 1)),
  );

export const encodeText = (codepoints: readonly string[]): EncodedText => ({
  bytes: BigInt64Array.from(codepoints.flatMap(byteSlots)),
  hashes: BigInt64Array.from(codepoints.map(hash)),
});
