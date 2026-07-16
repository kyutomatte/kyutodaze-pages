function configuredBasePath() {
  return import.meta.env?.BASE_URL ?? "/";
}

export function normalizeBasePath(basePath = configuredBasePath()) {
  const segment = String(basePath || "/").replace(/^\/+|\/+$/g, "");
  return segment ? `/${segment}/` : "/";
}

export function toSitePath(pathname, basePath = configuredBasePath()) {
  const base = normalizeBasePath(basePath);
  const route = String(pathname || "/").replace(/^\/+/, "");

  if (base === "/") return `/${route}`;
  return route ? `${base}${route}` : base;
}

export function fromSitePath(pathname, basePath = configuredBasePath()) {
  const base = normalizeBasePath(basePath);
  const path = pathname || "/";

  if (base === "/") return path;
  const prefix = base.slice(0, -1);
  if (path === prefix) return "/";
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
}

export function toPublicAssetUrl(pathname, basePath = configuredBasePath()) {
  return toSitePath(pathname, basePath);
}
