import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error('r2_not_configured');
  return value;
}

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: requireEnv('R2_ENDPOINT'),
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
    });
  }
  return client;
}

export function getR2Env(): string {
  const env = requireEnv('R2_ENV');
  if (env !== 'prod' && env !== 'staging') {
    throw new Error('r2_not_configured');
  }
  return env;
}

export function getR2Bucket(): string {
  return requireEnv('R2_BUCKET');
}

export async function presignPut(params: {
  storageKey: string;
  mimeType: string;
  ttlSeconds: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: params.storageKey,
    ContentType: params.mimeType,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: params.ttlSeconds });
}

export async function presignGet(params: {
  storageKey: string;
  ttlSeconds: number;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: params.storageKey,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: params.ttlSeconds });
}

export async function objectExists(storageKey: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({
        Bucket: getR2Bucket(),
        Key: storageKey,
      }),
    );
    return true;
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
    if (code === 'NotFound' || code === 'NoSuchKey') return false;
    throw err;
  }
}
