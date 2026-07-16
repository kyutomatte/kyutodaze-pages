const previewableMediaPattern = /^\/assets\/(?:works|open-works)\/(?!.*\/thumbs\/).+\.(?:png|jpe?g|webp|gif|mp4|mov|webm)$/i;

function getLocalAssetPath(url) {
  const source = String(url ?? "");
  if (!source.startsWith("/")) return "";

  const assetIndex = source.indexOf("/assets/");
  return assetIndex === -1 ? "" : source.slice(assetIndex);
}

export function isPreviewableLocalMediaUrl(url) {
  return previewableMediaPattern.test(getLocalAssetPath(url));
}

export function getMediaPreviewUrl(url) {
  const source = String(url ?? "");
  if (!isPreviewableLocalMediaUrl(source)) return source;

  const assetIndex = source.indexOf("/assets/");
  const basePath = source.slice(0, assetIndex);
  const parts = source.slice(assetIndex).split("/");
  const file = parts.pop();
  return `${basePath}${parts.join("/")}/thumbs/${file}.webp`;
}
