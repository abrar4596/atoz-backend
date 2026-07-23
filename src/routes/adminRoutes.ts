import express from 'express'
import { triggerReorder, createProduct, getDistributors } from '../controllers/adminController'
import { getFlaggedInventory, getDashboardStats } from '../controllers/inventoryController'
import { authMiddleware, adminMiddleware } from '../middlewares/auth'

const router = express.Router()

router.post('/reorder', triggerReorder)
router.get('/inventory', getFlaggedInventory)
router.get('/stats', getDashboardStats)
router.post('/products', authMiddleware, adminMiddleware, createProduct)
router.get('/distributors', authMiddleware, adminMiddleware, getDistributors)

export default router
