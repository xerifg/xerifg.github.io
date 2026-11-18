// Exact image references from BevFusion revision 89f29c4, before f08b8e7
// replaced them with expired browser URLs. Never infer repairs from filenames.
const bevFusionImages = [
  ["blob:https://xerifg.github.io/93d18d2d-fc4d-401c-9dea-ca13193087cc", "image-20260825024246-jdw6a.png", 168330],
  ["blob:https://xerifg.github.io/e3863ea2-0330-4c4d-a88d-cf92095ea709", "image-20260825031048-voxnn.png", 43028]
];

export function repairLegacyAssetReferences(note) {
  if (note.id !== "note-1787192363486") return note;
  let html = note.html || "";
  const assets = [...(note.assets || [])];
  for (const [expired, fileName, size] of bevFusionImages) {
    if (!html.includes(expired)) continue;
    const remotePath = `notebooks/assets/${note.id}/${fileName}`;
    html = html.split(expired).join(remotePath);
    if (!assets.some(asset => asset.remotePath === remotePath)) {
      assets.push({ id: fileName, name: "image.png", fileName, kind: "image", type: "image/png", size,
        localUrl: remotePath, remoteUrl: remotePath, remotePath, published: true });
    }
  }
  return { ...note, html, assets };
}
