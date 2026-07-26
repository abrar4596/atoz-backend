import express from 'express'
import { triggerReorder, getDistributors, deleteProduct, getProductPreview } from '../controllers/adminController'
import { getFlaggedInventory, getDashboardStats } from '../controllers/inventoryController'
import { createProduct, updateProduct } from '../controllers/productController'
import { getRoiDashboard } from '../controllers/dashboardController'
import { authMiddleware, adminMiddleware } from '../middlewares/auth'
import upload, { uploadImages } from '../middlewares/uploadMiddleware'

const router = express.Router()

router.post('/reorder', triggerReorder)
router.get('/inventory', getFlaggedInventory)
router.get('/stats', getDashboardStats)
router.get('/dashboard/roi', authMiddleware, adminMiddleware, getRoiDashboard)
router.post('/products', authMiddleware, adminMiddleware, uploadImages, createProduct)
router.get('/products/:id', authMiddleware, adminMiddleware, getProductPreview)
router.put('/products/:id', authMiddleware, adminMiddleware, uploadImages, updateProduct)
router.get('/distributors', authMiddleware, adminMiddleware, getDistributors)
router.delete('/products/:id', authMiddleware, adminMiddleware, deleteProduct)

export default router



