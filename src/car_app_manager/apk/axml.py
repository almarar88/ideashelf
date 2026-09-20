"""Minimal Android binary XML (AXML) parser for AndroidManifest.xml.

Pure Python, no third-party dependency: it extracts exactly what the install checks need
(package, versions, SDK levels, permissions, components, features, split name).
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import Optional

RES_STRING_POOL_TYPE = 0x0001
RES_XML_TYPE = 0x0003
RES_XML_START_NAMESPACE_TYPE = 0x0100
RES_XML_END_NAMESPACE_TYPE = 0x0101
RES_XML_START_ELEMENT_TYPE = 0x0102
RES_XML_END_ELEMENT_TYPE = 0x0103
RES_XML_CDATA_TYPE = 0x0104
RES_XML_RESOURCE_MAP_TYPE = 0x0180

TYPE_REFERENCE = 0x01
TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10
TYPE_INT_HEX = 0x11
TYPE_INT_BOOLEAN = 0x12

# android:attr resource ids -> attribute names (used when the name string is empty / obfuscated)
ATTR_IDS = {
    0x01010003: "name", 0x01010001: "label", 0x0101021b: "versionCode", 0x0101021c: "versionName",
    0x0101020c: "minSdkVersion", 0x01010270: "targetSdkVersion", 0x01010271: "maxSdkVersion",
    0x0101000f: "exported", 0x01010007: "debuggable", 0x01010272: "testOnly", 0x0101028e: "required",
}


class AXMLError(ValueError):
    pass


@dataclass
class Manifest:
    package: str = ""
    version_code: int = 0
    version_name: str = ""
    min_sdk: int = 0
    target_sdk: int = 0
    max_sdk: int = 0
    permissions: list[str] = field(default_factory=list)
    activities: list[str] = field(default_factory=list)
    services: list[str] = field(default_factory=list)
    receivers: list[str] = field(default_factory=list)
    providers: list[str] = field(default_factory=list)
    features: list[str] = field(default_factory=list)
    split: str = ""
    label: str = ""  # only when it is a literal string in the manifest
    test_only: bool = False


def _u16(b: bytes, o: int) -> int:
    return struct.unpack_from("<H", b, o)[0]


def _u32(b: bytes, o: int) -> int:
    return struct.unpack_from("<I", b, o)[0]


def _parse_string_pool(b: bytes, off: int) -> list[str]:
    header_size = _u16(b, off + 2)
    chunk_size = _u32(b, off + 4)
    count = _u32(b, off + 8)
    flags = _u32(b, off + 16)
    strings_start = _u32(b, off + 20)
    utf8 = bool(flags & 0x100)
    offsets = [_u32(b, off + header_size + i * 4) for i in range(count)]
    base = off + strings_start
    out: list[str] = []
    end = off + chunk_size
    for so in offsets:
        p = base + so
        if p >= end:
            out.append("")
            continue
        try:
            if utf8:
                # two lengths: char count then byte count, each 1 or 2 bytes
                n = b[p]; p += 1
                if n & 0x80:
                    p += 1
                m = b[p]; p += 1
                if m & 0x80:
                    m = ((m & 0x7F) << 8) | b[p]; p += 1
                out.append(b[p:p + m].decode("utf-8", "replace"))
            else:
                n = _u16(b, p); p += 2
                if n & 0x8000:
                    n = ((n & 0x7FFF) << 16) | _u16(b, p); p += 2
                out.append(b[p:p + n * 2].decode("utf-16-le", "replace"))
        except (IndexError, struct.error):
            out.append("")
    return out


def parse_manifest(data: bytes) -> Manifest:
    if len(data) < 8 or _u16(data, 0) != RES_XML_TYPE:
        raise AXMLError("not a binary XML document")
    total = min(_u32(data, 4), len(data))
    off = _u16(data, 2)
    strings: list[str] = []
    res_map: list[int] = []
    m = Manifest()
    stack: list[str] = []

    def attr_name(idx: int) -> str:
        name = strings[idx] if 0 <= idx < len(strings) else ""
        if not name and idx < len(res_map):
            name = ATTR_IDS.get(res_map[idx], "")
        if not name and idx < len(res_map) and res_map[idx] == 0:
            name = ""
        return name

    while off + 8 <= total:
        ctype = _u16(data, off)
        hsize = _u16(data, off + 2)
        csize = _u32(data, off + 4)
        if csize < 8:
            raise AXMLError("corrupt chunk")
        if ctype == RES_STRING_POOL_TYPE:
            strings = _parse_string_pool(data, off)
        elif ctype == RES_XML_RESOURCE_MAP_TYPE:
            res_map = [_u32(data, off + hsize + i * 4) for i in range((csize - hsize) // 4)]
        elif ctype == RES_XML_START_ELEMENT_TYPE:
            p = off + hsize
            name_idx = _u32(data, p + 4)
            attr_start = _u16(data, p + 8)
            attr_size = _u16(data, p + 10)
            attr_count = _u16(data, p + 12)
            tag = strings[name_idx] if name_idx < len(strings) else ""
            attrs: dict[str, object] = {}
            ap = p + attr_start
            for _ in range(attr_count):
                a_name = attr_name(_u32(data, ap + 4))
                raw = _u32(data, ap + 8)
                dtype = data[ap + 15]
                val = _u32(data, ap + 16)
                if dtype == TYPE_STRING:
                    value: object = strings[val] if val < len(strings) else (strings[raw] if raw < len(strings) else "")
                elif dtype in (TYPE_INT_DEC, TYPE_INT_HEX):
                    value = val
                elif dtype == TYPE_INT_BOOLEAN:
                    value = val != 0
                elif dtype == TYPE_REFERENCE:
                    value = f"@0x{val:08x}"
                else:
                    value = strings[raw] if raw < len(strings) else val
                if a_name:
                    attrs[a_name] = value
                ap += attr_size
            _apply(m, tag, attrs, stack)
            stack.append(tag)
        elif ctype == RES_XML_END_ELEMENT_TYPE:
            if stack:
                stack.pop()
        off += csize
    if not m.package:
        raise AXMLError("manifest has no package attribute")
    return m


def _apply(m: Manifest, tag: str, a: dict, stack: list[str]) -> None:
    def s(key: str) -> str:
        v = a.get(key, "")
        return v if isinstance(v, str) else str(v)

    def i(key: str) -> int:
        v = a.get(key, 0)
        if isinstance(v, bool):
            return int(v)
        if isinstance(v, int):
            return v
        try:
            return int(str(v))
        except ValueError:
            return 0

    if tag == "manifest":
        m.package = s("package")
        m.version_code = i("versionCode")
        m.version_name = s("versionName")
        m.split = s("split")
    elif tag == "uses-sdk":
        m.min_sdk = i("minSdkVersion") or m.min_sdk
        m.target_sdk = i("targetSdkVersion") or m.target_sdk
        m.max_sdk = i("maxSdkVersion") or m.max_sdk
    elif tag in ("uses-permission", "uses-permission-sdk-23"):
        n = s("name")
        if n and n not in m.permissions:
            m.permissions.append(n)
    elif tag == "uses-feature":
        n = s("name")
        if n:
            m.features.append(n)
    elif tag == "application":
        lbl = s("label")
        if lbl and not lbl.startswith("@"):
            m.label = lbl
        m.test_only = bool(a.get("testOnly", False))
    elif tag in ("activity", "activity-alias", "service", "receiver", "provider") and "application" in stack:
        n = s("name")
        if n.startswith("."):
            n = m.package + n
        {"activity": m.activities, "activity-alias": m.activities, "service": m.services,
         "receiver": m.receivers, "provider": m.providers}[tag].append(n)
