import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

export type ZipInput = {
  name: string;
  data: string | Buffer;
};

type ZipEntryMeta = {
  name: Buffer;
  crc: number;
  compressed: Buffer;
  rawLength: number;
  offset: number;
};

function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

/**
 * A small ZIP (deflate, UTF-8 filenames) so Excel can open three CSVs without a new dependency.
 * General-purpose bit 11 marks the filename as UTF-8.
 */
export function buildZip(files: readonly ZipInput[], now = new Date()): Buffer {
  const stamp = dosDateTime(now);
  const locals: Buffer[] = [];
  const metas: ZipEntryMeta[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const raw = typeof file.data === "string" ? Buffer.from(file.data, "utf8") : file.data;
    const compressed = deflateRawSync(raw);
    const checksum = crc32(raw) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const chunk = Buffer.concat([local, name, compressed]);
    locals.push(chunk);
    metas.push({
      name,
      crc: checksum,
      compressed,
      rawLength: raw.length,
      offset,
    });
    offset += chunk.length;
  }

  const centrals = metas.map((meta) => {
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(meta.crc, 16);
    central.writeUInt32LE(meta.compressed.length, 20);
    central.writeUInt32LE(meta.rawLength, 24);
    central.writeUInt16LE(meta.name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(meta.offset, 42);
    return Buffer.concat([central, meta.name]);
  });

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralDir, eocd]);
}

export function readZip(buffer: Buffer): Array<{ name: string; data: Buffer }> {
  const entries: Array<{ name: string; data: Buffer }> = [];
  let pos = 0;
  while (pos + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(pos);
    if (signature !== 0x04034b50) break;
    const method = buffer.readUInt16LE(pos + 8);
    const compressedSize = buffer.readUInt32LE(pos + 18);
    const nameLength = buffer.readUInt16LE(pos + 26);
    const extraLength = buffer.readUInt16LE(pos + 28);
    const nameStart = pos + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const dataStart = nameStart + nameLength + extraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    entries.push({ name, data });
    pos = dataStart + compressedSize;
  }
  return entries;
}
