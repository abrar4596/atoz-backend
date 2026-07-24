import multer from 'multer'

// Use memoryStorage so files are kept in buffer (serverless safe)
const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // limit file size to 5MB
  },
})

export default upload
