import { promises as fs } from "node:fs";
import * as devalue from "devalue";
import xxhash, {} from "xxhash-wasm";
import { emptyDir } from "../core/fs/index.js";
import { DATA_STORE_MANIFEST_FILE } from "./consts.js";
function sortCollections(collections) {
  return new Map(
    [...collections.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, collection]) => [
      key,
      new Map([...collection.entries()].sort(([a], [b]) => a.localeCompare(b)))
    ])
  );
}
function serializeDataStore(collections) {
  return devalue.stringify(sortCollections(collections));
}
const ENCODER = new TextEncoder();
function chunkString(str, maxBytes) {
  const chunks = [];
  let startIndex = 0;
  let index = 0;
  let currentBytes = 0;
  for (const char of str) {
    const charBytes = ENCODER.encode(char).length;
    if (currentBytes + charBytes > maxBytes && index > startIndex) {
      chunks.push(str.slice(startIndex, index));
      startIndex = index;
      currentBytes = 0;
    }
    index += char.length;
    currentBytes += charBytes;
  }
  if (startIndex < str.length) {
    chunks.push(str.slice(startIndex));
  }
  return chunks;
}
async function writeFileAtomic(file, data) {
  const tempFile = file instanceof URL ? new URL(`${file.href}.tmp`) : `${file}.tmp`;
  const oldData = await fs.readFile(file, "utf-8").catch(() => "");
  if (oldData === data) {
    return;
  }
  await fs.writeFile(tempFile, data);
  await fs.rename(tempFile, file);
}
class FileWriter {
  #file;
  constructor(file) {
    this.#file = file;
  }
  async write(collections) {
    await writeFileAtomic(this.#file, serializeDataStore(collections));
  }
}
class ChunkedWriter {
  #dir;
  #manifestFile;
  #chunkSize;
  #hasher;
  constructor(dir, chunkSize) {
    this.#dir = dir;
    this.#manifestFile = new URL(`./${DATA_STORE_MANIFEST_FILE}`, dir);
    this.#chunkSize = chunkSize;
  }
  async write(collections) {
    if (!this.#hasher) {
      this.#hasher = await xxhash();
    }
    const { h64ToString } = this.#hasher;
    const writtenFiles = /* @__PURE__ */ new Set();
    const manifest = {};
    for (const [collectionName, entries] of sortCollections(collections)) {
      const stringified = devalue.stringify(entries);
      const parts = [];
      for (const part of chunkString(stringified, this.#chunkSize)) {
        const fileName = `${h64ToString(part)}.txt`;
        await writeFileAtomic(new URL(`./${fileName}`, this.#dir), part);
        parts.push(fileName);
        writtenFiles.add(fileName);
      }
      manifest[collectionName] = parts;
    }
    await writeFileAtomic(this.#manifestFile, JSON.stringify(manifest));
    writtenFiles.add(DATA_STORE_MANIFEST_FILE);
    emptyDir(this.#dir, writtenFiles);
  }
}
export {
  ChunkedWriter,
  FileWriter,
  chunkString,
  serializeDataStore,
  writeFileAtomic
};
