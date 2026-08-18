#!/usr/bin/env python3
"""Generate realistic PE/ELF hex files for the WEAPON course labs.

Each lab's answers must remain findable in the output. The generator builds
valid PE32+ / ELF64 structures with:
  - real DOS stub, NT headers, section table
  - a real import directory + IAT in .rdata
  - UTF-16 (wide) strings where appropriate
  - realistic noise: PDB path, CRT error strings, section padding

Output is a lowercase hex string written to public/binaries/*.hex.
"""
import struct
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "binaries")


def u16(x): return struct.pack("<H", x & 0xFFFF)
def u32(x): return struct.pack("<I", x & 0xFFFFFFFF)
def u64(x): return struct.pack("<Q", x & 0xFFFFFFFFFFFFFFFF)


def align(v, a):
    return (v + a - 1) // a * a


def ascii_bytes(s):
    return s.encode("latin-1")


def utf16_bytes(s):
    return s.encode("utf-16-le")


def dos_stub():
    """Standard 'This program cannot be run in DOS mode' stub."""
    return (b"This program cannot be run in DOS mode.\r\r\n$")


# ---------------------------------------------------------------------------
# PE builder
# ---------------------------------------------------------------------------

class PE:
    def __init__(self, image_base=0x140000000, section_align=0x1000, file_align=0x200, e_lfanew=0x80):
        self.image_base = image_base
        self.section_align = section_align
        self.file_align = file_align
        self.e_lfanew = e_lfanew
        self.sections = []  # list of (name, characteristics, raw_data)
        self.entry_rva = 0x1000
        self.subsystem = 3  # console
        self.dll_chars = 0x8160  # DYNAMIC_BASE | NX_COMPAT | TERMINAL_SERVER_AWARE | HIGH_ENTROPY_VA(0x20)
        self.timestamp = 0x5F3759DF  # plausible 2020-ish timestamp
        self.machine = 0x8664  # x64
        self.number_of_rva = 16
        self.size_of_headers = 0
        self.imports = []  # list of (dll_name, [func_names]) or (dll_name, [(ordinal,None)])

    def add_section(self, name, characteristics, raw):
        self.sections.append((name, characteristics, raw))

    def build_import_blob(self, base_rva):
        """Build the .rdata import-table content and return (bytes, dir_rva, dir_size)."""
        n_dlls = len(self.imports)
        imp_desc_size = 20
        # Layout within a fresh bytearray whose offset 0 == base_rva
        data = bytearray()
        desc_off = 0
        data += b"\x00" * (imp_desc_size * (n_dlls + 1))
        cursor = len(data)

        dll_name_offsets = []
        for dll_name, funcs in self.imports:
            cursor = align(cursor, 2)
            dll_name_offsets.append(cursor)
            cursor += len(ascii_bytes(dll_name)) + 1

        hint_name_offsets = []
        for dll_name, funcs in self.imports:
            fn_offs = []
            for fn in funcs:
                cursor = align(cursor, 2)
                fn_offs.append(cursor)
                cursor += 2 + len(ascii_bytes(fn)) + 1
            hint_name_offsets.append(fn_offs)

        int_arrays = []
        for dll_name, funcs in self.imports:
            cursor = align(cursor, 8)
            int_arrays.append(cursor)
            cursor += 8 * (len(funcs) + 1)

        iat_arrays = []
        for dll_name, funcs in self.imports:
            cursor = align(cursor, 8)
            iat_arrays.append(cursor)
            cursor += 8 * (len(funcs) + 1)

        data += b"\x00" * (cursor - len(data))

        imp_dir_rva = base_rva + desc_off
        for i, (dll_name, funcs) in enumerate(self.imports):
            d = desc_off + i * imp_desc_size
            int_rva = base_rva + int_arrays[i]
            iat_rva = base_rva + iat_arrays[i]
            name_rva = base_rva + dll_name_offsets[i]
            data[d:d+20] = u32(int_rva) + u32(0) + u32(0) + u32(name_rva) + u32(iat_rva)

        for i, (dll_name, _) in enumerate(self.imports):
            data[dll_name_offsets[i]:dll_name_offsets[i] + len(dll_name) + 1] = ascii_bytes(dll_name) + b"\x00"

        for i, (dll_name, funcs) in enumerate(self.imports):
            int_off = int_arrays[i]
            iat_off = iat_arrays[i]
            fn_offs = hint_name_offsets[i]
            for j, fn in enumerate(funcs):
                hint_rva = base_rva + fn_offs[j]
                data[int_off + j*8 : int_off + j*8 + 8] = u64(hint_rva)
                data[iat_off + j*8 : iat_off + j*8 + 8] = u64(hint_rva)
            for j, fn in enumerate(funcs):
                data[fn_offs[j]:fn_offs[j] + 2] = u16(0)
                data[fn_offs[j] + 2:fn_offs[j] + 2 + len(fn) + 1] = ascii_bytes(fn) + b"\x00"

        imp_dir_size = imp_desc_size * (n_dlls + 1)
        return bytes(data), imp_dir_rva, imp_dir_size

    def build(self):
        num_sec = len(self.sections)
        sizeof_optional = 0xF0
        pe_sig = 4
        coff = 20
        sect_hdr = 40
        headers_raw = 0x40 + pe_sig + coff + sizeof_optional + num_sec * sect_hdr
        self.size_of_headers = align(headers_raw, self.file_align)

        # Determine .rdata RVA first (it depends only on sections before it),
        # then build the import blob with that base RVA.
        rdata_base_rva = None
        rva = self.section_align
        for name, chars, raw in self.sections:
            if name == ".rdata":
                rdata_base_rva = rva
            rva += align(len(raw), self.section_align)

        import_info = None
        resolved_sections = []
        for name, chars, raw in self.sections:
            if name == ".rdata" and self.imports and rdata_base_rva is not None:
                blob, dir_rva, dir_size = self.build_import_blob(rdata_base_rva)
                import_info = (dir_rva, dir_size)
                raw = blob + raw
            resolved_sections.append((name, chars, raw))

        # section file offsets + RVAs
        rva = self.section_align  # first section at 0x1000
        sections = []
        file_off = self.size_of_headers
        for name, chars, raw in resolved_sections:
            raw_size = len(raw)
            virt_size = raw_size
            sections.append({
                "name": name,
                "chars": chars,
                "raw": raw,
                "rva": rva,
                "virt_size": virt_size,
                "raw_size": align(raw_size, self.file_align),
                "file_off": file_off,
            })
            file_off += align(raw_size, self.file_align)
            rva += align(virt_size, self.section_align)

        size_of_image = align(rva, self.section_align)

        # ---- headers ----
        out = bytearray()

        # DOS header
        out += b"MZ" + b"\x00" * 0x3A
        e_lfanew = self.e_lfanew
        out += u32(e_lfanew)  # e_lfanew at 0x3C
        out += dos_stub()
        # pad to e_lfanew
        if len(out) < e_lfanew:
            out += b"\x00" * (e_lfanew - len(out))
        assert len(out) == e_lfanew, (len(out), e_lfanew)

        # PE signature
        out += b"PE\x00\x00"

        # COFF header
        out += u16(self.machine)
        out += u16(num_sec)
        out += u32(self.timestamp)
        out += u32(0)  # PointerToSymbolTable
        out += u32(0)  # NumberOfSymbols
        out += u16(sizeof_optional)
        chars_coff = 0x0002 | 0x0020  # EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE
        out += u16(chars_coff)

        # Optional header PE32+
        opt = bytearray()
        opt += u16(0x20B)  # Magic PE32+
        opt += u16(0x0E)   # linker major/minor (14.x)
        opt += u32(0x200)  # SizeOfCode
        opt += u32(0x200)  # SizeOfInitializedData
        opt += u32(0)      # SizeOfUninitializedData
        opt += u32(self.entry_rva)  # AddressOfEntryPoint
        opt += u32(0x1000)  # BaseOfCode
        opt += u64(self.image_base)
        opt += u32(self.section_align)
        opt += u32(self.file_align)
        opt += u16(6) + u16(0)   # OS version
        opt += u16(0) + u16(0)   # image version
        opt += u16(6) + u16(0)   # subsystem version
        opt += u32(0)  # Win32VersionValue
        opt += u32(size_of_image)
        opt += u32(self.size_of_headers)
        opt += u32(0)  # CheckSum
        opt += u16(self.subsystem)
        opt += u16(self.dll_chars)
        opt += u64(0x100000)  # SizeOfStackReserve
        opt += u64(0x1000)    # SizeOfStackCommit
        opt += u64(0x100000)  # SizeOfHeapReserve
        opt += u64(0x1000)    # SizeOfHeapCommit
        opt += u32(0)  # LoaderFlags
        opt += u32(self.number_of_rva)
        # Data directories
        dirs = [(0, 0)] * 16
        if self.imports:
            dirs[1] = (0, 0)  # import RVA filled later
        for r, s in dirs:
            opt += u32(r) + u32(s)
        assert len(opt) == sizeof_optional, len(opt)
        out += opt

        # Section headers
        for s in sections:
            out += s["name"].encode("latin-1").ljust(8, b"\x00")
            out += u32(s["virt_size"])
            out += u32(s["rva"])
            out += u32(s["raw_size"])
            out += u32(s["file_off"])
            out += u32(0)  # relocs
            out += u32(0)  # linenumbers
            out += u16(0)  # num relocs
            out += u16(0)  # num linenumbers
            out += u32(s["chars"])

        # pad headers to size_of_headers
        out += b"\x00" * (self.size_of_headers - len(out))

        # ---- sections ----
        section_data = {}
        for s in sections:
            raw = bytearray(s["raw"])
            raw += b"\x00" * (s["raw_size"] - len(raw))
            section_data[s["name"]] = {"rva": s["rva"], "data": raw}

        # Patch import directory RVA/size in the optional header (DataDirectory[1]).
        if import_info is not None:
            dir_rva, dir_size = import_info
            opt_start = e_lfanew + 24
            dd_start = opt_start + 0x70
            import_dd_off = dd_start + 1 * 8
            out[import_dd_off:import_dd_off+8] = u32(dir_rva) + u32(dir_size)

        # assemble file
        for s in sections:
            out += section_data[s["name"]]["data"]

        return bytes(out), size_of_image


# ---------------------------------------------------------------------------
# Lab specs
# ---------------------------------------------------------------------------

R = 0x40000000
W = 0x80000000
X = 0x20000000
CODE = 0x20
IDATA = 0x40
UIDATA = 0x80

TEXT = R | X | CODE          # .text  R-X
RDATA = R | IDATA           # .rdata R--
DATA = R | W | IDATA         # .data  RW-


def code_bytes():
    """A short plausible x64 prologue as .text content."""
    return bytes.fromhex(
        "4883ec28"          # sub rsp, 0x28
        "488d0d00000000"    # lea rcx, [rip+0]
        "e800000000"        # call ...
        "33c0"              # xor eax, eax
        "4883c428"          # add rsp, 0x28
        "c3"                # ret
    )


def str_blob(parts):
    """Concatenate ascii/utf16 parts into one bytearray."""
    out = bytearray()
    for kind, text in parts:
        out += ascii_bytes(text) + b"\x00" if kind == "a" else utf16_bytes(text) + b"\x00\x00"
    return bytes(out)


def make_lab_01():
    """Hidden String Hunt: flag string hidden in DOS stub region."""
    pe = PE(e_lfanew=0x80)
    pe.entry_rva = 0x1000
    pe.add_section(".text", TEXT, code_bytes())
    rdata = str_blob([
        ("a", "The license key is invalid."),
        ("a", "Initializing runtime..."),
        ("a", "C:\\build\\mystery\\mystery.pdb"),
    ])
    pe.add_section(".rdata", RDATA, rdata)
    pe.add_section(".data", DATA, b"\x00" * 0x200)
    data, _ = pe.build()
    # Inject flag into the DOS stub padding (between the stub and e_lfanew).
    # The stub ends at 0x40 + len(dos_stub()); e_lfanew = 0x80.
    flag = b"WEAPON{first_flag}"
    stub_end = 0x40 + len(dos_stub())
    data = bytearray(data)
    flag_off = stub_end  # right after "This program cannot be run in DOS mode."
    data[flag_off:flag_off + len(flag)] = flag
    return bytes(data), flag_off


def make_lab_02():
    """Keylogger: USER32 imports SetWindowsHookExA / GetAsyncKeyState / GetForegroundWindow."""
    pe = PE()
    pe.add_section(".text", TEXT, code_bytes())
    pe.imports = [
        ("USER32.dll", ["SetWindowsHookExA", "GetAsyncKeyState", "GetForegroundWindow", "GetMessageA"]),
        ("KERNEL32.dll", ["GetModuleHandleA", "ExitProcess", "WriteFile"]),
    ]
    rdata = str_blob([
        ("a", "hooking keyboard..."),
        ("a", "C:\\Users\\dev\\source\\kbhook\\Release\\kbhook.pdb"),
    ])
    pe.add_section(".rdata", RDATA, rdata)
    pe.add_section(".data", DATA, b"\x00" * 0x200)
    return pe.build()


def make_lab_05():
    """Process injection: KERNEL32 VirtualAllocEx/WriteProcessMemory/CreateRemoteThread."""
    pe = PE()
    pe.add_section(".text", TEXT, code_bytes())
    pe.imports = [
        ("KERNEL32.dll", ["OpenProcess", "VirtualAllocEx", "WriteProcessMemory", "CreateRemoteThread", "CloseHandle"]),
    ]
    rdata = str_blob([
        ("a", "injecting payload..."),
        ("a", "target process not found"),
    ])
    pe.add_section(".rdata", RDATA, rdata)
    pe.add_section(".data", DATA, b"\x00" * 0x200)
    return pe.build()


def make_lab_11():
    """PE forensics: entry point in .data (RWX) — 2 sections only."""
    pe = PE()
    # .text at 0x1000, .data at 0x2000; entry point inside .data
    pe.entry_rva = 0x2000  # inside .data
    pe.add_section(".text", TEXT, code_bytes())
    data = bytearray(b"\x90" * 0x40)  # NOP sled + decrypted code placeholder
    data += b"\x00" * 0x200
    pe.add_section(".data", R | W | X | IDATA, bytes(data))  # RWX
    return pe.build()


def make_lab_12():
    """DLL load order: VERSION.dll + WININET + ADVAPI32."""
    pe = PE()
    pe.add_section(".text", TEXT, code_bytes())
    pe.imports = [
        ("VERSION.dll", ["GetFileVersionInfoSizeW", "VerQueryValueW"]),
        ("WININET.dll", ["InternetOpenW", "InternetConnectW"]),
        ("ADVAPI32.dll", ["RegCreateKeyExW", "RegSetValueExW"]),
    ]
    rdata = str_blob([
        ("a", "checking for updates..."),
    ])
    pe.add_section(".rdata", RDATA, rdata)
    pe.add_section(".data", DATA, b"\x00" * 0x200)
    return pe.build()


def make_lab_13():
    """C2 beacon: WININET http chain + ADVAPI32 persistence + GetTempPathW."""
    pe = PE()
    pe.add_section(".text", TEXT, code_bytes())
    pe.imports = [
        ("WININET.dll", ["InternetOpenW", "InternetConnectW", "HttpOpenRequestW", "HttpSendRequestW"]),
        ("ADVAPI32.dll", ["RegCreateKeyExW", "RegSetValueExW"]),
        ("KERNEL32.dll", ["GetTempPathW", "WriteFile", "Sleep"]),
    ]
    rdata = str_blob([
        ("a", "beacon check-in..."),
        ("w", "https://c2.example.com/beacon"),
        ("a", "C:\\Users\\dev\\beacon\\x64\\Release\\beacon.pdb"),
    ])
    pe.add_section(".rdata", RDATA, rdata)
    pe.add_section(".data", DATA, b"\x00" * 0x200)
    return pe.build()


def make_lab_16():
    """UPX packed: UPX! signature + UPX0/UPX1 sections."""
    pe = PE(e_lfanew=0x80)
    # UPX style: UPX0 (empty, executable), UPX1 (compressed payload)
    pe.entry_rva = 0x2000  # stub in UPX1
    pe.add_section("UPX0", R | X, b"")  # empty, R-X
    # UPX1 with high-entropy-like payload (pseudo-random)
    import random
    random.seed(1337)
    payload = bytes(random.randrange(256) for _ in range(0x400))
    pe.add_section("UPX1", R | X | CODE, payload)
    data, _ = pe.build()
    # Inject UPX! signature right after the DOS stub (like real UPX markers).
    data = bytearray(data)
    sig = b"UPX!"
    off = 0x40 + len(dos_stub())
    data[off:off+4] = sig
    return bytes(data)


def make_lab_capstone():
    """Unknown binary: C2 domain, mutex, injection + persistence imports."""
    pe = PE()
    pe.add_section(".text", TEXT, code_bytes())
    pe.imports = [
        ("WININET.dll", ["InternetOpenW", "InternetConnectW", "HttpSendRequestW"]),
        ("KERNEL32.dll", ["VirtualAllocEx", "CreateRemoteThread", "OpenProcess", "WriteProcessMemory"]),
        ("ADVAPI32.dll", ["RegSetValueExW"]),
    ]
    rdata = str_blob([
        ("a", "deep-space-c2.net"),
        ("w", "Global\\capstone_mutex_7"),
        ("a", "Software\\Microsoft\\Windows\\CurrentVersion\\Run"),
        ("a", "%APPDATA%\\winlogon.exe"),
        ("a", "C:\\build\\payload\\unknown.pdb"),
    ])
    pe.add_section(".rdata", RDATA, rdata)
    pe.add_section(".data", DATA, b"\x00" * 0x200)
    return pe.build()


# ---------------------------------------------------------------------------
# Raw (non-PE) blobs — realistic malware strings with noise
# ---------------------------------------------------------------------------

def make_raw_lab_04():
    """Strings: C2 URL, Run key, mutex. Raw blob with surrounding noise."""
    strings = [
        b"http://malware-c2.xyz/gate.php",
        b"Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        b"Global\\mx_0x1A2B3C",
    ]
    import random
    random.seed(99)
    out = bytearray()
    # leading noise
    out += bytes(random.randrange(256) for _ in range(0x40))
    for s in strings:
        out += s + b"\x00"
        out += bytes(random.randrange(256) for _ in range(0x20))
    out += bytes(random.randrange(256) for _ in range(0x40))
    return bytes(out)


def make_raw_lab_14():
    """Persistence: Run key, svchost.exe, RegSetValueExW/CreateServiceW."""
    strings = [
        b"Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        b"svchost.exe",
        b"RegSetValueExW",
        b"CreateServiceW",
    ]
    import random
    random.seed(7)
    out = bytearray(bytes(random.randrange(256) for _ in range(0x40)))
    for s in strings:
        out += s + b"\x00"
        out += bytes(random.randrange(256) for _ in range(0x20))
    out += bytes(random.randrange(256) for _ in range(0x40))
    return bytes(out)


def make_raw_lab_15():
    """C2 config: domain, port, path, InternetConnectW."""
    strings = [
        b"c2.example.com",
        b"443",
        b"beacon.php",
        b"InternetConnectW",
    ]
    import random
    random.seed(21)
    out = bytearray(bytes(random.randrange(256) for _ in range(0x40)))
    for s in strings:
        out += s + b"\x00"
        out += bytes(random.randrange(256) for _ in range(0x20))
    out += bytes(random.randrange(256) for _ in range(0x40))
    return bytes(out)


def make_raw_lab_17():
    """IOC extraction: URL, mutex, HKCU run key, temp drop."""
    strings = [
        b"http://evil.example.net/update",
        b"Global\\mutex_zz9",
        b"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        b"%TEMP%\\svc.exe",
    ]
    import random
    random.seed(55)
    out = bytearray(bytes(random.randrange(256) for _ in range(0x40)))
    for s in strings:
        out += s + b"\x00"
        out += bytes(random.randrange(256) for _ in range(0x20))
    out += bytes(random.randrange(256) for _ in range(0x40))
    return bytes(out)


def to_hex(data):
    return data.hex()


def write(name, data):
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        f.write(to_hex(data))
    print(f"{name}: {len(data)} bytes")


if __name__ == "__main__":
    import random
    random.seed(0)

    data, flag_off = make_lab_01()
    write("lab-01.hex", data)
    print("  flag offset: 0x%x" % flag_off)

    write("lab-02.hex", make_lab_02()[0])
    write("lab-05.hex", make_lab_05()[0])
    write("lab-11.hex", make_lab_11()[0])
    write("lab-12.hex", make_lab_12()[0])
    write("lab-13.hex", make_lab_13()[0])
    write("lab-16.hex", make_lab_16())
    write("lab-capstone.hex", make_lab_capstone()[0])

    write("lab-04.hex", make_raw_lab_04())
    write("lab-14.hex", make_raw_lab_14())
    write("lab-15.hex", make_raw_lab_15())
    write("lab-17.hex", make_raw_lab_17())
