import { Request, Response } from 'express'
import Product, { ProductCategory } from '../models/Product'
import Inventory, { InventoryStatus } from '../models/Inventory'

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { category, brand, localAvailability } = req.query

    const filters: any = {}

    if (category) {
      const categoryStr = String(category)
      const validCategories = Object.values(ProductCategory) as string[]
      if (!validCategories.includes(categoryStr)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: '${categoryStr}'. Must be one of: ${validCategories.join(', ')}`,
        })
      }
      filters.category = categoryStr as ProductCategory
    }

    if (brand) {
      const trimmedBrand = String(brand).trim()
      if (trimmedBrand === '') {
        return res.status(400).json({
          success: false,
          error: 'Brand parameter cannot be empty.',
        })
      }
      filters.brand = { $regex: new RegExp(`^${trimmedBrand}$`, 'i') }
    }

    if (localAvailability === 'true') {
      const availableProductIds = await Inventory.find({
        status: { $in: [InventoryStatus.IN_STOCK, InventoryStatus.LOW_STOCK] },
      }).distinct('productId')
      filters._id = { $in: availableProductIds }
    }

    const products = await Product.find(filters)

    const productIds = products.map((p) => p._id)
    const inventories = await Inventory.find({ productId: { $in: productIds } })

    const inventoryMap: Record<string, typeof inventories> = {}
    for (const inv of inventories) {
      const pid = inv.productId.toString()
      if (!inventoryMap[pid]) {
        inventoryMap[pid] = []
      }
      inventoryMap[pid].push(inv)
    }

    const enrichedProducts = products.map((product) => {
      const productInventories = inventoryMap[product._id.toString()] || []
      const totalStock = productInventories.reduce((sum, inv) => sum + (inv.stockQuantity || 0), 0)

      let overallStatus = InventoryStatus.OUT_OF_STOCK
      if (totalStock >= 3) {
        overallStatus = InventoryStatus.IN_STOCK
      } else if (totalStock > 0) {
        overallStatus = InventoryStatus.LOW_STOCK
      }

      return {
        ...product.toObject(),
        inventory: {
          totalStock,
          status: overallStatus,
          batches: productInventories.map((inv) => ({
            batchNumber: inv.batchNumber,
            stockQuantity: inv.stockQuantity,
            expiryDate: inv.expiryDate,
            status: inv.status,
          })),
        },
      }
    })

    return res.json({
      success: true,
      count: enrichedProducts.length,
      data: enrichedProducts,
    })
  } catch (error: any) {
    console.error('Error fetching supplement catalog:', error)
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving the supplement catalog.',
      details: error.message,
    })
  }
}

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    return res.json({ success: true, data: product })
  } catch (error: any) {
    console.error('Error fetching product by ID:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
