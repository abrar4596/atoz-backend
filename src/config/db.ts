import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const LOCAL_FALLBACK_URI = 'mongodb://127.0.0.1:27017/atoz_supplements';
const getMongoUri = () => process.env.MONGODB_URI || LOCAL_FALLBACK_URI;

const isSrvDnsError = (error: any) => {
  return (
    error?.code === 'ENOTFOUND' &&
    error?.syscall === 'querySrv' &&
    typeof error?.hostname === 'string' &&
    error.hostname.endsWith('cluster.mongodb.net')
  )
}

export const dbConnect = async () => {
  try {
    // Disable command buffering to prevent queries from hanging indefinitely when disconnected
    mongoose.set('bufferCommands', false);

    if (mongoose.connection.readyState >= 1) {
      return mongoose.connection;
    }

    const MONGODB_URI = getMongoUri();
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Simple migration to rename email to phone on existing users and drop old unique email index
    try {
      const db = conn.connection.db;
      if (db) {
        const collections = await db.listCollections({ name: 'users' }).toArray();
        if (collections.length > 0) {
          const usersCollection = db.collection('users');

          // Rename 'email' to 'phone' if 'phone' does not exist and 'email' exists
          await usersCollection.updateMany(
            { phone: { $exists: false }, email: { $exists: true } },
            [
              {
                $set: {
                  phone: '$email'
                }
              },
              {
                $unset: ['email']
              }
            ]
          );

          // Drop unique index on email if it exists
          const indexes = await usersCollection.indexes();
          const emailIndex = indexes.find(idx => idx.name === 'email_1');
          if (emailIndex) {
            await usersCollection.dropIndex('email_1');
            console.log('Successfully dropped unique email index from users collection.');
          }
        }
      }
    } catch (migErr) {
      console.error('Database migration error:', migErr);
    }

    return conn.connection;
  } catch (error: any) {
    console.error('MongoDB connection error:', error);

    if (isSrvDnsError(error)) {
      const fallbackUri = LOCAL_FALLBACK_URI;
      console.warn(`Falling back to local MongoDB at ${fallbackUri} because Atlas SRV DNS lookup failed.`)
      const conn = await mongoose.connect(fallbackUri, {
        serverSelectionTimeoutMS: 5000,
      })
      console.log(`MongoDB connected: ${conn.connection.host} (local fallback)`)
      return conn.connection
    }

    throw error;
  }
};
