import { describe, expect, it } from 'vitest';
import { isDirectVideoUrl, normalizeEmbeddedVideoUrl } from './videoUrl';

describe('videoUrl', () => {
  it('recognizes directly playable media files', () => {
    expect(isDirectVideoUrl('https://cdn.example.org/course/lesson.mp4?token=abc')).toBe(true);
    expect(isDirectVideoUrl('https://www.youtube.com/embed/video-id')).toBe(false);
  });

  it('normalizes YouTube page and short links', () => {
    expect(normalizeEmbeddedVideoUrl('https://www.youtube.com/watch?v=abc123')).toBe('https://www.youtube.com/embed/abc123');
    expect(normalizeEmbeddedVideoUrl('https://youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123');
  });

  it('normalizes Bilibili video pages', () => {
    expect(normalizeEmbeddedVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(
      'https://player.bilibili.com/player.html?bvid=BV1xx411c7mD',
    );
  });
});
