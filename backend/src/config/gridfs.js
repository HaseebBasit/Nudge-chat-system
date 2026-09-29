import mongoose from 'mongoose';
import { Readable } from 'stream';

let gridFSBucket = null;

export const getGridFSBucket = () => {
  if (!gridFSBucket) {
    if (!mongoose.connection.db) {
      throw new Error('Database connection is not yet ready for GridFS');
    }
    gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'media'
    });
  }
  return gridFSBucket;
};

/**
 * Uploads a buffer directly to MongoDB GridFS
 * @param {Object} options
 * @param {Buffer} options.buffer
 * @param {string} options.filename
 * @param {string} options.contentType
 * @param {Object} options.metadata
 * @returns {Promise<Object>} The uploaded GridFS file document
 */
export const uploadBufferToGridFS = ({ buffer, filename, contentType, metadata = {} }) => {
  return new Promise((resolve, reject) => {
    try {
      const bucket = getGridFSBucket();
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);

      const uploadStream = bucket.openUploadStream(filename, {
        contentType,
        metadata
      });

      uploadStream.on('error', (error) => {
        reject(error);
      });

      uploadStream.on('finish', () => {
        resolve({
          _id: uploadStream.id,
          filename,
          contentType,
          length: buffer.length,
          metadata
        });
      });

      readableStream.pipe(uploadStream);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Finds file metadata by ObjectId
 * @param {string|mongoose.Types.ObjectId} fileId
 * @returns {Promise<Object|null>}
 */
export const findGridFSFile = async (fileId) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  const files = await bucket.find({ _id: objectId }).toArray();
  return files.length > 0 ? files[0] : null;
};

/**
 * Opens a readable download stream for a file in GridFS
 * @param {string|mongoose.Types.ObjectId} fileId
 * @returns {ReadableStream}
 */
export const openGridFSDownloadStream = (fileId) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(objectId);
};

/**
 * Deletes a file from GridFS
 * @param {string|mongoose.Types.ObjectId} fileId
 */
export const deleteGridFSFile = async (fileId) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  await bucket.delete(objectId);
};
