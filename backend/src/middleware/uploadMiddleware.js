import multer from 'multer';

// Store uploaded files in memory temporarily before streaming directly to GridFS
const storage = multer.memoryStorage();

// 25MB maximum upload limit
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    // We allow standard images, audio (voice), documents, zip
    cb(null, true);
  }
});
