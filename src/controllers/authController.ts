import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'atoz-default-jwt-secret-key-change-in-prod'
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change-this-secret'

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function signPayload(payload: string) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url')
}

export const login = async (req: Request, res: Response) => {
  try {
    const phoneInput = (req.body.phoneNumber ?? req.body.phone ?? '').toString().trim()
    const password = req.body.password

    if (!phoneInput || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required',
        error: 'Phone number and password are required',
      })
    }

    const normalizedPhone = phoneInput.toLowerCase()
    const adminPhone = process.env.ADMIN_PHONE?.toString().trim()
    const adminPassword = process.env.ADMIN_PASSWORD?.toString()
    const isAdminAlias =
      normalizedPhone === 'admin' ||
      normalizedPhone === 'administrator' ||
      (adminPhone ? normalizedPhone === adminPhone.toLowerCase() : false)

    if (isAdminAlias && (!adminPhone || !adminPassword)) {
      return res.status(500).json({
        success: false,
        message: 'Admin login credentials are not configured in the environment',
        error: 'Admin login credentials are not configured in the environment',
      })
    }

    const lookupPhone = isAdminAlias ? adminPhone : phoneInput

    let user = await User.findOne({ phone: lookupPhone }).select('+passwordHash')

    if (!user && isAdminAlias && adminPhone && adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      user = await User.findOneAndUpdate(
        { phone: adminPhone },
        {
          $setOnInsert: {
            name: 'Admin',
            phone: adminPhone,
            passwordHash,
            isAdmin: true,
            loyaltyPoints: 0,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).select('+passwordHash')
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', error: 'Invalid credentials' })
    }

    if (user.passwordHash) {
      const passwordMatches = await bcrypt.compare(password, user.passwordHash)
      if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Invalid credentials', error: 'Invalid credentials' })
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Password sign-in not set up for this account',
        error: 'Password sign-in not set up for this account',
      })
    }

    const payloadStr = JSON.stringify({
      userId: user._id.toString(),
      phone: user.phone,
      role: user.isAdmin ? 'admin' : 'user',
      iat: Date.now(),
    })

    const payloadBase64 = encodeBase64Url(payloadStr)
    const token = `${payloadBase64}.${signPayload(payloadBase64)}`

    const jwtToken = jwt.sign(
      { userId: user._id.toString(), phone: user.phone, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.cookie('atoz_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 8, // 8h
    })

    return res.status(200).json({
      success: true,
      token: token,
      jwtToken: jwtToken,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        isAdmin: user.isAdmin,
        loyaltyPoints: user.loyaltyPoints,
      }
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Login failed',
      error: error.message || 'Login failed',
    })
  }
}

export const register = async (req: Request, res: Response) => {
  try {
    const { name, phone, password } = req.body
    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required' })
    }

    const existingUser = await User.findOne({ phone: phone.trim() })
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Phone number already in use' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      name,
      phone: phone.trim(),
      passwordHash,
      loyaltyPoints: 0,
      isAdmin: false,
    })

    return res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        isAdmin: user.isAdmin,
        loyaltyPoints: user.loyaltyPoints,
      }
    })
  } catch (error: any) {
    console.error('Registration error:', error)
    return res.status(500).json({ success: false, error: error.message || 'Registration failed' })
  }
}

export const getProfile = async (req: any, res: Response) => {
  try {
    let user = req.user
    if (!user) {
      user = await User.findOne({ phone: '1234567890' })
      if (!user) {
        user = await User.create({
          name: 'John Doe',
          phone: '1234567890',
          googleId: 'mock-google-12345',
          loyaltyPoints: 320,
        })
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        googleId: user.googleId,
        loyaltyPoints: user.loyaltyPoints,
        isAdmin: user.isAdmin,
      }
    })
  } catch (error: any) {
    console.error('Profile fetching error:', error)
    return res.status(500).json({ success: false, error: error.message || 'Server error' })
  }
}
