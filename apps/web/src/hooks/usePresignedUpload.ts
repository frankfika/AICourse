/**
 * usePresignedUpload — React hook 包装 uploadsApi.upload
 *
 * 2026-07-24: P0 — 视频上传管道
 *
 * 用法:
 *   const { upload, uploading, progress, error, reset } = usePresignedUpload();
 *   await upload({ scope: 'lesson-video', file, refId: lessonId });
 *
 * 返 { upload, uploading, progress (0-100), error, reset }
 */
import { useCallback, useState } from 'react';
import { uploadsApi, UploadOptions, UploadResult, UploadProgress } from '../lib/uploadsApi';

export function usePresignedUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  const upload = useCallback(async (opts: Omit<UploadOptions, 'onProgress'>): Promise<UploadResult> => {
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const r = await uploadsApi.upload({
        ...opts,
        onProgress: (p: UploadProgress) => setProgress(p.percent),
      });
      setResult(r);
      setProgress(100);
      return r;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, progress, error, result, reset };
}
