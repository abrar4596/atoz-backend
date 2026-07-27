import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Product from '../models/Product'
import Inventory from '../models/Inventory'
import { sendPurchaseOrderEmail } from '../services/emailService'
import Distributor from '../models/Distributor'

export const triggerReorder = async (req: Request, res: Response) => {
  try {
    const { productId } = req.body
    if (!productId) {
      return res.status(400).json({ success: false, error: 'productId is required' })
    }

    const product = await Product.findById(productId).populate('distributorId').lean() as any
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    const inventoryItem = await Inventory.findOne({ productId }).lean()
    const minimumOrderQuantity = Math.max(3 - (inventoryItem?.stockQuantity ?? 0), 1)

    const distributorEmail = product.distributorId?.contactEmail || process.env.DEFAULT_DISTRIBUTOR_EMAIL
    if (!distributorEmail) {
      return res.status(400).json({ success: false, error: 'Distributor email unavailable' })
    }

    const result = await sendPurchaseOrderEmail({
      to: distributorEmail,
      productName: product.name,
      sku: product.sku,
      distributorName: product.distributorId?.name || 'Distributor',
      minimumOrderQuantity,
    })

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Failed to send email' })
    }

    return res.status(200).json({ success: true, message: 'Purchase order dispatched' })
  } catch (error: any) {
    console.error('Reorder controller error:', error)
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' })
  }
}


export const getDistributors = async (req: Request, res: Response) => {
  try {
    let distributors = await Distributor.find({})
    if (distributors.length === 0) {
      console.log('No distributors found, auto-seeding defaults...')
      distributors = await Distributor.create([
        {
          name: 'Apex Nutrition Distributors',
          contactEmail: 'orders@apexnutrition.com',
          contactPhone: '+1 (555) 019-2834',
          address: '100 Muscle Alley, Fitness City, CA 90210',
        },
        {
          name: 'Titan Wholesale Supplements',
          contactEmail: 'wholesale@titansupps.com',
          contactPhone: '+1 (555) 014-9988',
          address: '450 Iron Drive, Power Town, TX 75001',
        },
      ])
    }
    return res.status(200).json({ success: true, data: distributors })
  } catch (error: any) {
    console.error('Error fetching distributors:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }

  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Product ID format' })
    }

    let deletedProduct = null
    let session: mongoose.ClientSession | null = null

    // Try executing with a transaction if supported, else fallback to standard execution
    try {
      session = await mongoose.startSession()
      await session.withTransaction(async () => {
        // Cascading Cleanup: First, delete the document from the Product collection
        deletedProduct = await Product.findByIdAndDelete(id).session(session)
        if (deletedProduct) {
          // Next, delete all corresponding rows in the Inventory collection
          await Inventory.deleteMany({ productId: id }).session(session)
        }
      })
    } catch (txError: any) {
      console.warn('Mongoose transaction failed or not supported, falling back to sequential delete:', txError.message)
      // Fallback if transaction is not supported (e.g., standalone local MongoDB)
      deletedProduct = await Product.findByIdAndDelete(id)
      if (deletedProduct) {
        await Inventory.deleteMany({ productId: id })
      }
    } finally {
      if (session) {
        await session.endSession()
      }
    }

    if (!deletedProduct) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    return res.status(200).json({
      success: true,
      message: 'Product and linked inventory deleted successfully'
    })
  } catch (error: any) {
    console.error('Error in deleteProduct controller:', error)
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while deleting the product.',
      details: error.message
    })
  }
}

export const getProductPreview = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Product ID format' })
    }

    const product = await Product.findById(id).lean()
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    const inventory = await Inventory.findOne({ productId: id }).lean()

    return res.status(200).json({
      success: true,
      product,
      inventory: inventory || null
    })
  } catch (error: any) {
    console.error('Error in getProductPreview controller:', error)
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving the product preview.',
      details: error.message
    })
  }
}


