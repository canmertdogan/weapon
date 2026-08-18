export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
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
