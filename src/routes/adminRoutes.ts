import express from 'express'
import { triggerReorder, getDistributors, deleteProduct } from '../controllers/adminController'
import { getFlaggedInventory, getDashboardStats } from '../controllers/inventoryController'
import { createProduct, updateProduct } from '../controllers/productController'
import { authMiddleware, adminMiddleware } from '../middlewares/auth'
import upload, { uploadImages } from '../middlewares/uploadMiddleware'

const router = express.Router()

router.post('/reorder', triggerReorder)
router.get('/inventory', getFlaggedInventory)
router.get('/stats', getDashboardStats)
router.post('/products', authMiddleware, adminMiddleware, uploadImages, createProduct)
router.put('/products/:id', authMiddleware, adminMiddleware, uploadImages, updateProduct)
router.get('/distributors', authMiddleware, adminMiddleware, getDistributors)
router.delete('/products/:id', authMiddleware, adminMiddleware, deleteProduct)

export default router

