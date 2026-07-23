#!/usr/bin/env node
/**
 * create_admin.js
 * Usage:
 *   node scripts/create_admin.js <phone> <password>
 * OR set env vars: ADMIN_PHONE, ADMIN_PASSWORD, MONGO_URI
 */

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

function maskMongoUri(uri) {
  try {
    const parsed = new URL(uri)
    const username = parsed.username ? '***' : ''
    const password = parsed.password ? '***' : ''
    const auth = username || password ? `${username}:${password}@` : ''
    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}${parsed.search}`
  } catch {
    return '[redacted]' 
  }
}

async function main() {
  const phone = (process.argv[2] || process.env.ADMIN_PHONE || '').toString().trim()
  const password = (process.argv[3] || process.env.ADMIN_PASSWORD || '').toString()
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI

  if (!phone || !password) {
    console.error('Missing admin credentials. Set ADMIN_PHONE and ADMIN_PASSWORD in the environment file or pass them as CLI args.')
    process.exit(1)
  }

  if (!mongoUri) {
    console.error('Missing MongoDB connection string. Set MONGO_URI or MONGODB_URI in the environment file.')
    process.exit(1)
  }

  console.log('Connecting to MongoDB:', maskMongoUri(mongoUri))
  await mongoose.connect(mongoUri)

  // require compiled model (dist) so this works without building TS
  const UserModulePath = path.join(__dirname, '..', 'dist', 'src', 'models', 'User')
  let User
  try {
    const mod = require(UserModulePath)
    User = mod.default || mod.User || mod
  } catch (err) {
    console.error('Failed to load User model from', UserModulePath)
    console.error(err)
    process.exit(1)
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)

    const update = {
      name: 'Admin',
      phone: phone.toString(),
      passwordHash,
      isAdmin: true,
      loyaltyPoints: 0,
      updatedAt: new Date(),
    }

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true }

    const res = await User.findOneAndUpdate({ phone: phone.toString() }, { $set: update }, opts)
    console.log('Admin user created/updated:', {
      _id: res._id?.toString(),
      phone: res.phone,
      isAdmin: res.isAdmin,
      name: res.name,
    })
  } catch (err) {
    console.error('Error creating admin user:', err)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
