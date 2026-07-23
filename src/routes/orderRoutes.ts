import express from 'express'
import { getOrderHistory, createOrder } from '../controllers/orderController'
import { authMiddleware } from '../middlewares/auth'

const router = express.Router()

router.get('/history', getOrderHistory)
router.post('/checkout', createOrder)

export default router
