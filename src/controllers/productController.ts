import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Product, { ProductCategory } from '../models/Product'
import Inventory, { InventoryStatus } from '../models/Inventory'
import cloudinary from '../config/cloudinary'
import streamifier from 'streamifier'

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
    const inventory = await Inventory.findOne({ productId: id })
    return res.json({
      success: true,
      data: {
        ...product.toObject(),
        inventory: inventory ? {
          batchNumber: inventory.batchNumber,
          stockQuantity: inventory.stockQuantity,
          expiryDate: inventory.expiryDate,
          status: inventory.status,
        } : undefined
      }
    })
  } catch (error: any) {
    console.error('Error fetching product by ID:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

const uploadToCloudinary = (fileBuffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'products' },
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      }
    )
    streamifier.createReadStream(fileBuffer).pipe(stream)
  })
}

export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      sku,
      description,
      price: priceRaw,
      brand,
      imageUrl,
      category,
      flavourTags,
      distributorId,
      batchNumber,
      stockQuantity: stockQuantityRaw,
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
    if (!brand || typeof brand !== 'string' || brand.trim() === '') {
      return res.status(400).json({ success: false, error: 'Brand is required' })
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
    if (!expiryDate || isNaN(Date.parse(expiryDate))) {
      return res.status(400).json({ success: false, error: 'Valid expiry date is required' })
    }

    const price = priceRaw !== undefined ? Number(priceRaw) : undefined
    const stockQuantity = stockQuantityRaw !== undefined ? Number(stockQuantityRaw) : undefined

    if (price === undefined || isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, error: 'Price must be a positive number' })
    }
    if (stockQuantity === undefined || isNaN(stockQuantity) || stockQuantity < 0) {
      return res.status(400).json({ success: false, error: 'Stock quantity must be a non-negative number' })
    }

    // Process image file or fallback to URL
    let finalImageUrl = ''
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer)
        finalImageUrl = uploadResult.secure_url
      } catch (uploadError: any) {
        console.error('Cloudinary upload error:', uploadError)
        return res.status(500).json({ success: false, error: 'Failed to upload image to Cloudinary' })
      }
    } else if (imageUrl && typeof imageUrl === 'string') {
      finalImageUrl = imageUrl.trim()
    }

    if (!finalImageUrl) {
      return res.status(400).json({ success: false, error: 'Product image file or image URL is required' })
    }

    // Strict URL Validation using native URL constructor
    try {
      const parsedUrl = new URL(finalImageUrl)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ success: false, error: 'Invalid or non-absolute URL: Protocol must be http or https' })
      }
      finalImageUrl = parsedUrl.href
    } catch (urlError) {
      return res.status(400).json({ success: false, error: 'Invalid or non-absolute URL' })
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
      imageUrl: finalImageUrl,
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

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Product ID format' })
    }

    const {
      name,
      sku,
      description,
      price: priceRaw,
      brand,
      category,
      flavourTags,
      distributorId,
      batchNumber,
      stockQuantity: stockQuantityRaw,
      expiryDate,
    } = req.body

    // Validation checks
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ success: false, error: 'Product name cannot be empty' })
    }
    if (sku !== undefined && (typeof sku !== 'string' || sku.trim() === '')) {
      return res.status(400).json({ success: false, error: 'SKU cannot be empty' })
    }
    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
      return res.status(400).json({ success: false, error: 'Product description cannot be empty' })
    }
    if (brand !== undefined && (typeof brand !== 'string' || brand.trim() === '')) {
      return res.status(400).json({ success: false, error: 'Brand cannot be empty' })
    }
    if (category !== undefined && (typeof category !== 'string' || category.trim() === '')) {
      return res.status(400).json({ success: false, error: 'Category cannot be empty' })
    }

    const price = priceRaw !== undefined ? Number(priceRaw) : undefined
    const stockQuantity = stockQuantityRaw !== undefined ? Number(stockQuantityRaw) : undefined

    if (price !== undefined && (isNaN(price) || price < 0)) {
      return res.status(400).json({ success: false, error: 'Price must be a positive number' })
    }
    if (stockQuantity !== undefined && (isNaN(stockQuantity) || stockQuantity < 0)) {
      return res.status(400).json({ success: false, error: 'Stock quantity must be a non-negative number' })
    }
    if (expiryDate !== undefined && isNaN(Date.parse(expiryDate))) {
      return res.status(400).json({ success: false, error: 'Valid expiry date is required' })
    }

    // Check unique SKU
    if (sku) {
      const existingProduct = await Product.findOne({
        sku: sku.trim().toUpperCase(),
        _id: { $ne: id },
      })
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          error: `A product with SKU "${sku.toUpperCase()}" already exists`,
        })
      }
    }

    // Cloudinary stream upload for new image file if provided
    let finalImageUrl = undefined
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer)
        finalImageUrl = uploadResult.secure_url
      } catch (uploadError: any) {
        console.error('Cloudinary upload error:', uploadError)
        return res.status(500).json({ success: false, error: 'Failed to upload new image to Cloudinary' })
      }
    }

    if (finalImageUrl) {
      try {
        const parsedUrl = new URL(finalImageUrl)
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return res.status(400).json({ success: false, error: 'Invalid or non-absolute URL: Protocol must be http or https' })
        }
        finalImageUrl = parsedUrl.href
      } catch (urlError) {
        return res.status(400).json({ success: false, error: 'Invalid or non-absolute URL' })
      }
    }

    // Update Product document
    const productUpdate: any = {}
    if (name !== undefined) productUpdate.name = name.trim()
    if (sku !== undefined) productUpdate.sku = sku.trim().toUpperCase()
    if (description !== undefined) productUpdate.description = description.trim()
    if (price !== undefined) productUpdate.price = price
    if (brand !== undefined) productUpdate.brand = brand.trim()
    if (category !== undefined) productUpdate.category = category.trim()
    if (distributorId !== undefined) productUpdate.distributorId = distributorId
    if (finalImageUrl !== undefined) productUpdate.imageUrl = finalImageUrl

    if (flavourTags !== undefined) {
      productUpdate.flavourTags = Array.isArray(flavourTags)
        ? flavourTags.map(tag => String(tag).trim()).filter(Boolean)
        : typeof flavourTags === 'string'
        ? flavourTags.split(',').map(tag => tag.trim()).filter(Boolean)
        : []
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, productUpdate, { new: true })
    if (!updatedProduct) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    // Update or create linked Inventory document
    let updatedInventory = await Inventory.findOne({ productId: id })
    if (updatedInventory) {
      if (batchNumber !== undefined) updatedInventory.batchNumber = batchNumber.trim()
      if (stockQuantity !== undefined) updatedInventory.stockQuantity = stockQuantity
      if (expiryDate !== undefined) updatedInventory.expiryDate = new Date(expiryDate)
      await updatedInventory.save()
    } else {
      updatedInventory = new Inventory({
        productId: id,
        batchNumber: batchNumber ? batchNumber.trim() : 'BATCH-GEN-001',
        stockQuantity: stockQuantity !== undefined ? stockQuantity : 0,
        expiryDate: expiryDate ? new Date(expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      })
      await updatedInventory.save()
    }

    return res.status(200).json({
      success: true,
      data: {
        product: updatedProduct,
        inventory: updatedInventory,
      },
    })
  } catch (error: any) {
    console.error('Error in updateProduct controller:', error)
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while updating the product.',
      details: error.message,
    })
  }
}
