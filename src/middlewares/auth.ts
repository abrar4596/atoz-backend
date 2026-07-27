import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'atoz-default-jwt-secret-key-change-in-prod'
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change-this-secret'

export interface AuthRequest extends Request {
  user?: any
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token = req.headers.authorization?.split(' ')[1]
    
    if (!token || token === 'undefined' || token === 'null') {
      const cookieHeader = req.headers.cookie
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map((cookie) => cookie.trim().split('='))
        )
        token = cookies['atoz_admin_session']
      }
    }

    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ success: false, error: 'Authorization token required' })
    }

    let decoded: any = null
    
    if (token.includes('.')) {
      const parts = token.split('.')
      if (parts.length === 2) {
        // Next.js style custom HMAC session token
        const [payloadBase64, signature] = parts
        try {
          const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8')
          decoded = JSON.parse(payloadStr)
          
          const expectedSig = crypto
            .createHmac('sha256', SESSION_SECRET)
            .update(payloadBase64)
            .digest('base64url')

          if (signature !== expectedSig) {
            return res.status(401).json({ success: false, error: 'Invalid session signature' })
          }
        } catch (err) {
          return res.status(401).json({ success: false, error: 'Invalid session format' })
        }
      } else if (parts.length === 3) {
        // Standard JWT token
        decoded = jwt.verify(token, JWT_SECRET)
      }
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized session' })
    }

    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(401).json({ success: false, error: 'User session invalid' })
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return res.status(401).json({ success: false, error: 'Session expired or invalid' })
  }
}

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.isAdmin) {
    next()
  } else {
    res.status(403).json({ success: false, error: 'Admin access required' })
  }
}
