export type VideoPlatform = 'youtube' | 'bilibili';
export interface ParsedVideoUrl {
    platform: VideoPlatform;
    videoId: string;
    canonicalUrl: string;
    embedUrl: string;
}
export declare function parseVideoUrl(rawUrl: string): ParsedVideoUrl;
