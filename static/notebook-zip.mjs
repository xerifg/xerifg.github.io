// ZIP with stored entries: interoperable downloads without a runtime CDN dependency.
const encoder = new TextEncoder();
const table = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
export function zipFiles(files) {
  const local = []; const central = []; let offset = 0; let directorySize = 0;
  for (const file of files) {
    if (file.name.startsWith("/") || file.name.split(/[\\/]/).includes("..")) throw new Error("无效的导出路径");
    const name = encoder.encode(file.name); const bytes = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const crc = crc32(bytes); const header = new Uint8Array(30); const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true);
    h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, name.length, true);
    const entry = new Uint8Array(46); const c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true);
    c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    local.push(header, name, bytes); central.push(entry, name); offset += header.length + name.length + bytes.length; directorySize += entry.length + name.length;
  }
  const end = new Uint8Array(22); const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: "application/zip" });
}
