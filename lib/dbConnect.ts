import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/atoz_supplements'

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable')
}

// Extend the global object type
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: {
    conn: typeof mongoose.connection | null
    promise: Promise<typeof mongoose.connection> | null
  }
}

if (!global.mongooseCache) {
  global.mongooseCache = { conn: null, promise: null }
}

const cached = global.mongooseCache!

async function dbConnect() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    cached.promise = mongoose
      .connect(MONGODB_URI, opts as any)
      .then((mongooseInstance) => {
        return mongooseInstance.connection
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default dbConnect
