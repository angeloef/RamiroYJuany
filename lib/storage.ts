import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 (o cualquier S3): el backend solo firma, los bytes nunca pasan por aca.
const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta la variable de entorno ${k}`);
  return v;
};

let cliente: S3Client | null = null;
const s3 = () => (cliente ??= new S3Client({
  region: 'auto',
  endpoint: env('R2_ENDPOINT'),
  credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
}));

export const firmarPut = (key: string, contentType: string, bytes: number) =>
  getSignedUrl(s3(), new PutObjectCommand({
    Bucket: env('R2_BUCKET'),
    Key: key,
    ContentType: contentType,
    ContentLength: bytes,
  }), { expiresIn: 900 });

export const urlPublica = (key: string) => `${env('R2_PUBLIC_URL').replace(/\/$/, '')}/${key}`;
