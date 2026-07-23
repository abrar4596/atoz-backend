import { Request, Response } from 'express'
import Product from '../models/Product'
import Inventory from '../models/Inventory'
import { sendPurchaseOrderEmail } from '../services/emailService'

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

export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      sku,
      description,
      price,
      brand,
      imageUrl,
      category,
      flavourTags,
      distributorId,
      batchNumber,
      stockQuantity,
      expiryDate,
    } = req.body

    // 1. Strict Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Product name is required' })
    }
    if (!sku || typeof sku !== 'string' || sku.trim() === '') {
      return res.status(400).json({ success: false, error: 'SKU is required' })
    }
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ success: false, error: 'Product description is required' })
    }
    if (price === undefined || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ success: false, error: 'Price must be a positive number' })
    }
    if (!brand || typeof brand !== 'string' || brand.trim() === '') {
      return res.status(400).json({ success: false, error: 'Brand is required' })
    }
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      return res.status(400).json({ success: false, error: 'Image URL is required' })
    }
    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ success: false, error: 'Category is required' })
    }
    if (!distributorId) {
      return res.status(400).json({ success: false, error: 'Distributor reference is required' })
    }
    if (!batchNumber || typeof batchNumber !== 'string' || batchNumber.trim() === '') {
      return res.status(400).json({ success: false, error: 'Batch number is required' })
    }
    if (stockQuantity === undefined || typeof stockQuantity !== 'number' || stockQuantity < 0) {
      return res.status(400).json({ success: false, error: 'Stock quantity must be a non-negative number' })
    }
    if (!expiryDate || isNaN(Date.parse(expiryDate))) {
      return res.status(400).json({ success: false, error: 'Valid expiry date is required' })
    }

    // Check unique SKU
    const existingProduct = await Product.findOne({ sku: sku.trim().toUpperCase() })
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        error: `A product with SKU "${sku.toUpperCase()}" already exists`,
      })
    }

    // 2. Create Product Document
    const product = new Product({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      description: description.trim(),
      price,
      brand: brand.trim(),
      imageUrl: imageUrl.trim(),
      category: category.trim(),
      flavourTags: Array.isArray(flavourTags)
        ? flavourTags.map(tag => String(tag).trim()).filter(Boolean)
        : typeof flavourTags === 'string'
        ? flavourTags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [],
      distributorId,
    })

    await product.save()

    // 3. Sequentially Create Inventory Document
    try {
      const inventory = new Inventory({
        productId: product._id,
        batchNumber: batchNumber.trim(),
        stockQuantity,
        expiryDate: new Date(expiryDate),
      })
      await inventory.save()

      return res.status(201).json({
        success: true,
        data: {
          product,
          inventory,
        },
      })
    } catch (inventoryError: any) {
      console.error('Inventory creation failed, performing rollback. Error:', inventoryError)
      // Cleanup the product to prevent orphans
      await Product.findByIdAndDelete(product._id)
      return res.status(400).json({
        success: false,
        error: 'Failed to create inventory batch for the new product. Product creation rolled back.',
        details: inventoryError.message,
      })
    }
  } catch (error: any) {
    console.error('Error in createProduct controller:', error)
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while creating the product.',
      details: error.message,
    })
  }
}

export const getDistributors = async (req: Request, res: Response) => {
  try {
    const DistributorModule = require('../models/Distributor')
    const Distributor = DistributorModule.default || DistributorModule
    
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

