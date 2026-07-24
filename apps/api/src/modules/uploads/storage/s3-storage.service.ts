/**
 * S3StorageService — S3-compatible 存储 (MinIO / AWS S3 / 阿里 OSS / 腾讯 COS)
 *
 * 2026-07-24: P0 — 视频上传管道
 *
 * env 配置 (从 .env 读):
 *   MINIO_ENDPOINT=localhost
 *   MINIO_PORT=9010
 *   MINIO_USE_SSL=false
 *   MINIO_ROOT_USER=minioadmin
 *   MINIO_ROOT_PASSWORD=minioadmin
 *   MINIO_BUCKET=opencsg-academy
 *   MINIO_PUBLIC_URL_BASE=http://localhost:9010/opencsg-academy  (可选, 给前端访问用)
 *
 * 安全:
 *   - presigned URL 短期 (10-15 min), 即使泄露窗口小
 *   - 强制 publicRead bucket 路径走 MinIO 公开 endpoint
 *   - fail-closed: env 缺失则 throw, 不会静默走错 bucket
 */
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, PresignResult, ObjectMeta } from './storage.interface';

@Injectable()
export class S3StorageService extends StorageProvider implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private client: S3Client | null = null;
  private bucket = '';
  private publicUrlBase = '';
  private endpoint = '';
  private ready = false;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit() {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT');
    const port = Number(this.config.get<string>('MINIO_PORT') ?? 9000);
    const useSsl = this.config.get<string>('MINIO_USE_SSL') === 'true';
    const bucket = this.config.get<string>('MINIO_BUCKET');
    const accessKey = this.config.get<string>('MINIO_ROOT_USER');
    const secretKey = this.config.get<string>('MINIO_ROOT_PASSWORD');

    if (!endpoint || !bucket || !accessKey || !secretKey) {
      this.logger.warn(
        'S3 storage env 不全 (MINIO_ENDPOINT/MINIO_BUCKET/MINIO_ROOT_USER/MINIO_ROOT_PASSWORD), 上传功能禁用',
      );
      this.ready = false;
      return;
    }

    this.bucket = bucket;
    this.endpoint = `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`;
    // publicUrlBase 可单独配 (生产走 CDN / 公开域名), 默认 endpoint+port+bucket
    this.publicUrlBase =
      this.config.get<string>('MINIO_PUBLIC_URL_BASE') ?? `${this.endpoint}/${bucket}`;

    this.client = new S3Client({
      region: 'us-east-1', // MinIO 不要求, 但 SDK 必填
      endpoint: this.endpoint,
      forcePathStyle: true, // MinIO 用 path-style
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    this.ready = true;
    this.logger.log(`S3 storage ready: endpoint=${this.endpoint} bucket=${bucket}`);
  }

  private checkReady() {
    if (!this.ready || !this.client) {
      throw new ServiceUnavailableException('S3 存储未配置 (检查 MINIO_* env)');
    }
  }

  /** 公开 URL 基础 (e.g. http://localhost:9010/opencsg-academy), 给 complete 时拼 publicUrl */
  getPublicUrlBase(): string {
    return this.publicUrlBase;
  }

  async presignUpload(key: string, contentType: string, expiresIn: number): Promise<PresignResult> {
    this.checkReady();
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client!, cmd, { expiresIn });
    return {
      uploadUrl,
      publicUrl: `${this.publicUrlBase}/${key}`,
      key,
      expiresIn,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.checkReady();
    await this.client!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async headObject(key: string): Promise<ObjectMeta | null> {
    this.checkReady();
    try {
      const res = await this.client!.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        key,
        size: res.ContentLength ?? 0,
        contentType: res.ContentType,
        etag: res.ETag,
      };
    } catch (e: any) {
      if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') {
        return null;
      }
      throw e;
    }
  }
}
