const previewableMediaPattern = /^\/assets\/(?:works|open-works)\/(?!.*\/thumbs\/).+\.(?:png|jpe?g|webp|gif|mp4|mov|webm)$/i;

export function isPreviewableLocalMediaUrl(url) {
  return previewableMediaPattern.test(String(url ?? ""));
}

export function getMediaPreviewUrl(url) {
  const source = String(url ?? "");
  if (!isPreviewableLocalMediaUrl(source)) return source;

  const parts = source.split("/");
  const file = parts.pop();
  return `${parts.join("/")}/thumbs/${file}.webp`;
}
