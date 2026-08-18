export interface PEInfo {
  isPE: boolean;
  eLfanew: number;
  machine: number;
  numberOfSections: number;
  entryPoint: number;
  imageBase: number;
  characteristics: number;
  optionalHeaderMagic: number;
  dataDirectories: { rva: number; size: number }[];
  sections: { name: string; virtualSize: number; virtualAddress: number; sizeOfRawData: number; pointerToRawData: number; characteristics: number }[];
  hasRwxSection: boolean;
  importedStrings: string[];
  embeddedStrings: string[];
}

export function parsePE(bytes: Uint8Array): PEInfo {
  const info: PEInfo = {
    isPE: false,
    eLfanew: 0,
    machine: 0,
    numberOfSections: 0,
    entryPoint: 0,
    imageBase: 0,
    characteristics: 0,
    optionalHeaderMagic: 0,
    dataDirectories: [],
    sections: [],
    hasRwxSection: false,
    importedStrings: [],
    embeddedStrings: [],
  };

  if (bytes.length < 64) return info;
  if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) return info; // "MZ"

  info.eLfanew = readU32LE(bytes, 0x3c);
  if (bytes[info.eLfanew] !== 0x50 || bytes[info.eLfanew + 1] !== 0x45) return info; // "PE"
  info.isPE = true;

  const coff = info.eLfanew + 4;
  info.machine = readU16LE(bytes, coff);
  info.numberOfSections = readU16LE(bytes, coff + 2);
  info.characteristics = readU16LE(bytes, coff + 18);

  const opt = coff + 20;
  info.optionalHeaderMagic = readU16LE(bytes, opt);
  // PE32+ (0x20B) vs PE32 (0x10B)
  info.entryPoint = readU32LE(bytes, opt + 16);
  if (info.optionalHeaderMagic === 0x20b) {
    info.imageBase = readU64LE(bytes, opt + 24);
  } else {
    info.imageBase = readU32LE(bytes, opt + 28);
  }
  const dirOffset = info.optionalHeaderMagic === 0x20b ? 112 : 96;
  info.dataDirectories = [];
  for (let i = 0; i < 16; i++) {
    const off = opt + dirOffset + i * 8;
    info.dataDirectories.push({ rva: readU32LE(bytes, off), size: readU32LE(bytes, off + 4) });
  }

  const sectionTable = opt + (info.optionalHeaderMagic === 0x20b ? 240 : 224);
  for (let i = 0; i < info.numberOfSections; i++) {
    const off = sectionTable + i * 40;
    const nameBytes = bytes.slice(off, off + 8);
    let name = '';
    for (const b of nameBytes) {
      if (b === 0) break;
      name += String.fromCharCode(b);
    }
    const characteristics = readU32LE(bytes, off + 36);
    const section = {
      name,
      virtualSize: readU32LE(bytes, off + 8),
      virtualAddress: readU32LE(bytes, off + 12),
      sizeOfRawData: readU32LE(bytes, off + 16),
      pointerToRawData: readU32LE(bytes, off + 20),
      characteristics,
    };
    info.sections.push(section);
    // 0x40000000 = writable, 0x20000000 = executable
    if ((characteristics & 0x40000000) && (characteristics & 0x20000000)) {
      info.hasRwxSection = true;
    }
  }

  info.importedStrings = extractStrings(bytes);
  return info;
}

export function extractStrings(bytes: Uint8Array, minLength: number = 4): string[] {
  const strings: string[] = [];
  let current = '';
  let start = -1;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 0x20 && b <= 0x7e) {
      if (start === -1) start = i;
      current += String.fromCharCode(b);
    } else {
      if (current.length >= minLength) {
        strings.push(current);
      }
      current = '';
      start = -1;
    }
  }
  if (current.length >= minLength) strings.push(current);
  return strings;
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readU64LE(bytes: Uint8Array, offset: number): number {
  const lo = readU32LE(bytes, offset);
  const hi = readU32LE(bytes, offset + 4);
  return hi * 0x100000000 + lo;
}
