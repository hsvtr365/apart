export function thumbnailUrl(url: string | null) {
  return url?.startsWith("/api/uploads/")
    ? url.split("?")[0] + "?size=feed"
    : url;
}
