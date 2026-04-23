import { Storage } from '@google-cloud/storage';
import path from 'path';

// Initialize Google Cloud Storage client
let storage: Storage;

export function initializeGCS(): Storage | null {
  const projectId = process.env.GCS_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'athleteiq-project';
  
  // Try to get credentials from environment variable (JSON string)
  let credentials: any;
  
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    } catch (e) {
      console.warn('⚠️  GOOGLE_CLOUD_CREDENTIALS is not valid JSON, using default credentials');
    }
  }
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Using GOOGLE_APPLICATION_CREDENTIALS path:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  try {
    storage = new Storage({
      projectId,
      ...(credentials && { credentials })
    });
    
    return storage;
  } catch (error) {
    console.warn('⚠️  Failed to initialize Google Cloud Storage:', error);
    return null;
  }
}

export function getGCS(): Storage {
  if (!storage) {
    initializeGCS();
  }
  return storage;
}

export async function generateSignedUrl(
  bucketName: string,
  fileName: string,
  expirationMinutes: number = 15
): Promise<string> {
  const bucket = getGCS().bucket(bucketName);
  const file = bucket.file(fileName);
  
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expirationMinutes * 60 * 1000,
  });

  return signedUrl;
}

export async function downloadFile(
  bucketName: string,
  fileName: string,
  destinationPath: string
): Promise<void> {
  const bucket = getGCS().bucket(bucketName);
  const file = bucket.file(fileName);
  
  await file.download({ destination: destinationPath });
}

export async function uploadFile(
  bucketName: string,
  fileName: string,
  sourcePath: string,
  metadata?: { [key: string]: string }
): Promise<string> {
  const bucket = getGCS().bucket(bucketName);
  const file = bucket.file(fileName);
  
  await file.save(require('fs').readFileSync(sourcePath), {
    metadata: {
      contentType: getContentType(fileName),
      ...metadata,
    }
  });

  return `gs://${bucketName}/${fileName}`;
}

export async function uploadBuffer(
  bucketName: string,
  fileName: string,
  buffer: Buffer,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  const bucket = getGCS().bucket(bucketName);
  const file = bucket.file(fileName);
  
  await file.save(buffer, {
    metadata: {
      contentType,
    },
  });

  return `gs://${bucketName}/${fileName}`;
}

export async function deleteFile(
  bucketName: string,
  fileName: string
): Promise<void> {
  const bucket = getGCS().bucket(bucketName);
  await bucket.file(fileName).delete();
}

export async function deleteFolder(
  bucketName: string,
  folderPrefix: string
): Promise<void> {
  const bucket = getGCS().bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: folderPrefix });
  
  const deletePromises = files.map(file => file.delete());
  await Promise.all(deletePromises);
}

export async function listFiles(
  bucketName: string,
  prefix: string
): Promise<Array<{ name: string; size: number; updated: Date }>> {
  const bucket = getGCS().bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix });

  return files.map(file => ({
    name: file.name,
    size: file.metadata.size || 0,
    updated: new Date(file.metadata.updated || Date.now()),
  }));
}

export async function getFilePublicUrl(
  bucketName: string,
  fileName: string
): Promise<string> {
  return `https://storage.googleapis.com/${bucketName}/${fileName}`;
}

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const contentTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.json': 'application/json',
  };
  return contentTypes[ext] || 'application/octet-stream';
}
