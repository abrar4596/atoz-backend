import express from 'express';
import Product, { ProductCategory } from '../../models/Product';
import Inventory, { InventoryStatus } from '../../models/Inventory';

const router = express.Router();

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const categoryParam = searchParams.get('category');
    const brandParam = searchParams.get('brand');
    const localAvailabilityParam = searchParams.get('localAvailability');

    const filters: any = {};

    // Validate category parameter
    if (categoryParam !== null) {
      const validCategories = Object.values(ProductCategory) as string[];
      if (!validCategories.includes(categoryParam)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: '${categoryParam}'. Must be one of: ${validCategories.join(', ')}`,
        });
      }
      filters.category = categoryParam as ProductCategory;
    }

    // Validate brand parameter
    if (brandParam !== null) {
      const trimmedBrand = brandParam.trim();
      if (trimmedBrand === '') {
        return res.status(400).json({
          success: false,
          error: 'Brand parameter cannot be empty.',
        });
      }
      filters.brand = { $regex: new RegExp(`^${trimmedBrand}$`, 'i') };
    }

    // Handle local availability filtering
    if (localAvailabilityParam === 'true') {
      const availableProductIds = await Inventory.find({
        status: { $in: [InventoryStatus.IN_STOCK, InventoryStatus.LOW_STOCK] },
      }).distinct('productId');
      filters._id = { $in: availableProductIds };
    }

    // Query Products
    const products = await Product.find(filters);

    // Enrich products with inventory status and batch information
    const productIds = products.map((p) => p._id);
    const inventories = await Inventory.find({ productId: { $in: productIds } });

    // Group inventory records by product ID
    const inventoryMap: Record<string, typeof inventories> = {};
    for (const inv of inventories) {
      const pid = inv.productId.toString();
      if (!inventoryMap[pid]) {
        inventoryMap[pid] = [];
      }
      inventoryMap[pid].push(inv);
    }

    // Map through products and append combined inventory metadata
    const enrichedProducts = products.map((product) => {
      const productInventories = inventoryMap[product._id.toString()] || [];

      // Sum stock quantity across all batches
      const totalStock = productInventories.reduce((sum, inv) => sum + (inv.stockQuantity || 0), 0);

      // Determine cumulative inventory status
      let overallStatus = InventoryStatus.OUT_OF_STOCK;
      if (totalStock >= 3) {
        overallStatus = InventoryStatus.IN_STOCK;
      } else if (totalStock > 0) {
        overallStatus = InventoryStatus.LOW_STOCK;
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
      };
    });

    // Send standardized success response
    return res.json({
      success: true,
      count: enrichedProducts.length,
      data: enrichedProducts,
    });
  } catch (error: any) {
    console.error('Error fetching supplement catalog:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving the supplement catalog.',
      details: error.message,
    });
  }
});

export default router;
