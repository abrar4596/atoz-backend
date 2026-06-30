import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/atoz_supplements'

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable')
}

const globalWithMongoose = global as typeof globalThis & {
  mongoose?: {
    conn: any
    promise: Promise<any> | null
  }
}

let cached = globalWithMongoose.mongoose

if (!cached) {
  cached = globalWithMongoose.mongoose = { conn: null, promise: null }
}

async function dbConnect() {
  if (!cached) {
    throw new Error('Cached mongoose not initialized')
  }
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts as any).then((mongooseInstance) => {
      return mongooseInstance.connection
    })
  }
  cached.conn = await cached.promise
  return cached.conn
}

export default dbConnect
