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
    error.hostname.endsWith('mongodb.net')
  );
};

// Global is used here to maintain a cached connection across hot reloads in development
// and across function invocations in serverless environments.
declare global {
  var mongoose: {
    conn: mongoose.Connection | null;
    promise: Promise<mongoose.Connection> | null;
  } | undefined;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const runMigration = async (connection: mongoose.Connection) => {
  try {
    const db = connection.db;
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
};

const seedDefaultDistributor = async () => {
  try {
    const DistributorModule = require('../models/Distributor');
    const Distributor = DistributorModule.default || DistributorModule;
    const count = await Distributor.countDocuments();
    if (count === 0) {
      console.log('No distributors found. Seeding dummy distributor...');
      await Distributor.create({
        name: 'Apex Global Distributors',
        contactEmail: 'dummy@apex.com',
        contactPhone: '123-456-7890',
        address: '123 Apex Way, Supply City, SC 12345',
      });
      console.log('Dummy distributor seeded successfully.');
    }
  } catch (seedErr) {
    console.error('Error seeding default distributor:', seedErr);
  }
};

export const dbConnect = async () => {
  // Disable command buffering to prevent queries from hanging indefinitely when disconnected
  mongoose.set('bufferCommands', false);

  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const opts = {
      serverSelectionTimeoutMS: 5000,
    };

    const MONGODB_URI = getMongoUri();

    cached!.promise = (async () => {
      try {
        const conn = await mongoose.connect(MONGODB_URI, opts);
        console.log(`MongoDB connected: ${conn.connection.host}`);
        await runMigration(conn.connection);
        await seedDefaultDistributor();
        return conn.connection;
      } catch (error: any) {
        console.error('MongoDB connection error:', error);

        const fallbackUri = LOCAL_FALLBACK_URI;
        console.warn(`Falling back to local MongoDB at ${fallbackUri} due to connection failure.`);
        try {
          const conn = await mongoose.connect(fallbackUri, opts);
          console.log(`MongoDB connected: ${conn.connection.host} (local fallback)`);
          await runMigration(conn.connection);
          await seedDefaultDistributor();
          return conn.connection;
        } catch (fallbackErr) {
          console.error('Failed to connect to local MongoDB fallback:', fallbackErr);
          throw error;
        }
      }
    })();
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    throw e;
  }

  return cached!.conn;
};
