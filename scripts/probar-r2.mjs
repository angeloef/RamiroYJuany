// Chequeo de humo de R2: firma un PUT, sube un archivito y lo lee por la URL publica.
import 'dotenv/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const Key = 'prueba/hola.txt';
const body = 'hola boda';

const url = await getSignedUrl(s3, new PutObjectCommand({
  Bucket: process.env.R2_BUCKET, Key, ContentType: 'text/plain', ContentLength: body.length,
}), { expiresIn: 300 });

const put = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': 'text/plain' } });
console.log('PUT firmado :', put.status, put.ok ? 'ok' : await put.text());

const pub = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${Key}`;
const get = await fetch(pub);
console.log('URL publica :', get.status, get.ok ? JSON.stringify(await get.text()) : 'no accesible');

await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key }));
console.log('limpieza    : objeto de prueba borrado');
