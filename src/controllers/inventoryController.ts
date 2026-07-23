import { Request, Response } from 'express'
import Inventory from '../models/Inventory'

export const getFlaggedInventory = async (req: Request, res: Response) => {
  try {
    const sixtyDaysAhead = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

    const items = await Inventory.find({
      $or: [{ stockQuantity: { $lt: 3 } }, { expiryDate: { $lte: sixtyDaysAhead } }],
    })
      .populate({
        path: 'productId',
        populate: { path: 'distributorId', model: 'Distributor' },
      })
      .sort({ expiryDate: 1, stockQuantity: 1 })

    return res.status(200).json({ success: true, data: items })
  } catch (error: any) {
    console.error('Error fetching flagged inventory:', error)
    return res.status(500).json({ success: false, error: error.message || 'Server error' })
  }
}

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const inventoryItems = await Inventory.find({}).populate({
      path: 'productId',
      populate: { path: 'distributorId', model: 'Distributor' },
    })

    const flaggedItems = inventoryItems.filter((item: any) => {
      const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null
      const daysToExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999
      return item.stockQuantity < 3 || daysToExpiry < 60
    })

    const cashSaved = flaggedItems.reduce((sum: number, item: any) => {
      const price = item.productId?.price ?? 0
      const unitsAtRisk = Math.max(3 - item.stockQuantity, 1)
      return sum + price * unitsAtRisk * 0.85
    }, 0)

    return res.status(200).json({
      success: true,
      data: {
        cashSaved: Math.round(cashSaved),
        criticalActionRequired: flaggedItems.length,
        flaggedItems: flaggedItems.map(item => ({
          _id: item._id,
          batchNumber: item.batchNumber,
          stockQuantity: item.stockQuantity,
          expiryDate: item.expiryDate,
          productId: item.productId,
        })),
      }
    })
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error)
    return res.status(500).json({ success: false, error: error.message || 'Server error' })
  }
}
