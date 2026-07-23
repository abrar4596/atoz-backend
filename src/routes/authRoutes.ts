import express from 'express'
import { login, register, getProfile } from '../controllers/authController'
import { authMiddleware } from '../middlewares/auth'

const router = express.Router()

router.post('/login', login)
router.post('/register', register)
router.get('/profile', authMiddleware, getProfile)

export default router
