import { Request, Response } from 'express'
import Inventory from '../models/Inventory'
import Product from '../models/Product'

export const getRoiDashboard = async (req: Request, res: Response) => {
  try {
    const today = new Date()
    
    // Algorithm 1: Critical Action Required & Current Alerts List
    const sixtyDaysFromNow = new Date()
    sixtyDaysFromNow.setDate(today.getDate() + 60)

    const itemsAtRisk = await Inventory.find({
      $or: [
        { stockQuantity: { $lt: 3 } },
        { expiryDate: { $lte: sixtyDaysFromNow } }
      ]
    })
      .populate('productId', 'name price imageUrls')
      .lean()

    const alerts = itemsAtRisk.map((item: any) => {
      const isLowStock = item.stockQuantity < 3
      const isExpiringSoon = item.expiryDate && new Date(item.expiryDate) <= sixtyDaysFromNow
      
      let issue = 'Action needed'
      if (isLowStock && isExpiringSoon) {
        issue = 'Critical: Both'
      } else if (isLowStock) {
        issue = 'Low Stock'
      } else if (isExpiringSoon) {
        issue = 'Expiring Soon'
      }

      return {
        _id: item._id,
        batchNumber: item.batchNumber,
        stockQuantity: item.stockQuantity,
        expiryDate: item.expiryDate,
        status: item.status,
        productId: item.productId || null,
        issue
      }
    })

    const criticalActionCount = alerts.length

    // Algorithm 2: Cash Saved (30 Days) - Heuristic for 90 Days out
    const ninetyDaysFromNow = new Date()
    ninetyDaysFromNow.setDate(today.getDate() + 90)

    const cashSavedResult = await Inventory.aggregate([
      {
        $match: {
          expiryDate: { $gte: today, $lte: ninetyDaysFromNow }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $group: {
          _id: null,
          totalCashSaved: {
            $sum: { $multiply: ['$product.price', '$stockQuantity'] }
          }
        }
      }
    ])

    const cashSaved = cashSavedResult[0]?.totalCashSaved || 0

    return res.status(200).json({
      success: true,
      data: {
        cashSaved,
        criticalActionCount,
        alerts
      }
    })
  } catch (error: any) {
    console.error('Error fetching ROI dashboard stats:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
}
