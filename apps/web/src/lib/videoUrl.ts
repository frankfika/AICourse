export function isDirectVideoUrl(value: string): boolean {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)$/.test(pathname);
  } catch {
    return false;
  }
}

export function normalizeEmbeddedVideoUrl(value: string): string {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : value;
    }
    if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com') {
      const id = url.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
    if (hostname === 'bilibili.com' || hostname === 'www.bilibili.com' || hostname === 'm.bilibili.com') {
      const match = url.pathname.match(/\/video\/(BV[\w]+)/i);
      if (match) return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(match[1])}`;
    }
    return value;
  } catch {
    return value;
  }
}
