// Maps the ASCII code of a hex digit to its nibble value; invalid chars map to 0xFF.
const HEX_NIBBLE = (() => {
  const lut = new Uint8Array(128).fill(0xff);
  for (let i = 0; i <= 9; i++) lut[48 + i] = i; // '0'-'9'
  for (let i = 0; i <= 5; i++) lut[65 + i] = 10 + i; // 'A'-'F'
  for (let i = 0; i <= 5; i++) lut[97 + i] = 10 + i; // 'a'-'f'
  return lut;
})();

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const hi = HEX_NIBBLE[clean.charCodeAt(i * 2)];
    const lo = HEX_NIBBLE[clean.charCodeAt(i * 2 + 1)];
    if (hi === 0xff || lo === 0xff) {
      throw new Error(`Invalid hex string: bad digit at position ${i * 2}`);
    }
    bytes[i] = (hi << 4) | lo;
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function toHex(value: number, width: number = 16): string {
  return '0x' + value.toString(16).toUpperCase().padStart(width, '0');
}

export function isPrintableByte(b: number): boolean {
  return b >= 0x20 && b <= 0x7e;
}

export function byteToAscii(b: number): string {
  return isPrintableByte(b) ? String.fromCharCode(b) : '.';
}

export interface HexRow {
  offset: number;
  bytes: number[];
  ascii: string;
}

export function buildHexRows(bytes: Uint8Array, bytesPerRow: number = 16): HexRow[] {
  const rows: HexRow[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    const rowBytes: number[] = [];
    let ascii = '';
    for (let j = 0; j < bytesPerRow && i + j < bytes.length; j++) {
      const b = bytes[i + j];
      rowBytes.push(b);
      ascii += byteToAscii(b);
    }
    rows.push({ offset: i, bytes: rowBytes, ascii });
  }
  return rows;
}
