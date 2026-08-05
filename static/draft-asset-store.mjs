const databaseName = "personal-notebook-draft-assets-v1";
const storeName = "assets";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function openDatabase(indexedDb) {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open draft asset storage"));
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function dataUrlToBlob(dataUrl) {
  const [header, content = ""] = String(dataUrl || "").split(",", 2);
  const type = header.match(/^data:([^;,]+)/i)?.[1] || "application/octet-stream";
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

export async function blobToBase64(blob) {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

function legacyAssetDataUrl(asset) {
  if (String(asset?.dataUrl || "").startsWith("data:")) return asset.dataUrl;
  if (String(asset?.localUrl || "").startsWith("data:")) return asset.localUrl;
  if (asset?.content) return `data:${asset.type || "application/octet-stream"};base64,${asset.content}`;
  return "";
}

export async function hydrateDraftAsset(asset, store) {
  const assetId = asset?.assetId || asset?.id;
  if (!assetId) return asset;
  let blob = asset.storage === "indexeddb" ? await store.get(assetId) : null;
  if (!blob) {
    const legacyDataUrl = legacyAssetDataUrl(asset);
    if (!legacyDataUrl) {
      if (asset.storage === "indexeddb") throw new Error(`附件缺少本地缓存：${asset.name || asset.fileName || assetId}`);
      return { ...asset, assetId };
    }
    blob = dataUrlToBlob(legacyDataUrl);
    await store.put(assetId, blob);
  }
  const localUrl = await store.createObjectUrl(assetId);
  return { ...asset, assetId, storage: "indexeddb", localUrl, content: "", dataUrl: "" };
}

export function restoreDraftAssetReferences(html, assets = []) {
  return (assets || []).reduce((content, asset) => {
    if (asset?.storage !== "indexeddb" || !asset?.assetId || !asset?.localUrl) return content;
    return content.split(`draft-asset://${asset.assetId}`).join(asset.localUrl);
  }, html || "");
}

export function createDraftAssetStore(options = {}) {
  const indexedDb = options.indexedDB || globalThis.indexedDB;
  const urlApi = options.URL || globalThis.URL;
  const memory = options.memory;
  let databasePromise;
  const database = () => {
    if (!indexedDb) throw new Error("此浏览器不支持 IndexedDB，无法保存本地附件");
    databasePromise ||= openDatabase(indexedDb);
    return databasePromise;
  };
  const withStore = async (mode, run) => {
    const db = await database();
    const transaction = db.transaction(storeName, mode);
    const result = await run(transaction.objectStore(storeName));
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Draft asset storage failed"));
      transaction.onabort = () => reject(transaction.error || new Error("Draft asset storage aborted"));
    });
    return result;
  };

  return {
    async put(assetId, blob) {
      if (memory) return memory.set(assetId, blob);
      return withStore("readwrite", (store) => requestResult(store.put(blob, assetId)));
    },
    async get(assetId) {
      if (memory) return memory.get(assetId) || null;
      return withStore("readonly", (store) => requestResult(store.get(assetId)));
    },
    async remove(assetId) {
      if (memory) return memory.delete(assetId);
      return withStore("readwrite", (store) => requestResult(store.delete(assetId)));
    },
    async createObjectUrl(assetId) {
      const blob = await this.get(assetId);
      if (!blob) return "";
      return urlApi.createObjectURL(blob);
    }
  };
}
