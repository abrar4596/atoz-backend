import { Request, Response } from 'express'
import Order from '../models/Order'
import User from '../models/User'
import Inventory from '../models/Inventory'

export const getOrderHistory = async (req: any, res: Response) => {
  try {
    let user = req.user
    if (!user) {
      user = await User.findOne({ phone: '1234567890' })
      if (!user) {
        user = await User.create({
          name: 'John Doe',
          phone: '1234567890',
          googleId: 'mock-google-12345',
          loyaltyPoints: 320,
        })
      }
    }

    let orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 })

    if (orders.length === 0) {
      const mockOrdersData = [
        {
          userId: user._id,
          items: [
            {
              productId: 'mock-p1',
              name: '100% Whey Gold Standard Protein',
              brand: 'Optimum Nutrition',
              flavour: 'Double Rich Chocolate',
              quantity: 1,
              price: 74.99
            },
            {
              productId: 'mock-p2',
              name: 'C4 Original Pre-Workout Powder',
              brand: 'Cellucor',
              flavour: 'Cherry Limeade',
              quantity: 2,
              price: 34.99
            }
          ],
          totalAmount: 144.97,
          status: 'Delivered',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5)
        },
        {
          userId: user._id,
          items: [
            {
              productId: 'mock-p3',
              name: 'Organic Plant Based Protein Powder',
              brand: 'Orgain',
              flavour: 'Creamy Chocolate Fudge',
              quantity: 1,
              price: 32.99
            }
          ],
          totalAmount: 32.99,
          status: 'Processing',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1)
        },
        {
          userId: user._id,
          items: [
            {
              productId: 'mock-p4',
              name: 'Opti-Men Multivitamin',
              brand: 'Optimum Nutrition',
              flavour: 'Unflavoured',
              quantity: 1,
              price: 29.99
            }
          ],
          totalAmount: 29.99,
          status: 'Ready for Pickup',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4)
        }
      ]

      orders = (await Order.create(mockOrdersData as any)) as any
      orders.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    return res.status(200).json({ success: true, data: orders })
  } catch (error: any) {
    console.error('Error fetching order history:', error)
    return res.status(500).json({ success: false, error: error.message || 'Server error' })
  }
}

export const createOrder = async (req: any, res: Response) => {
  try {
    const { items, totalAmount, status } = req.body
    let user = req.user
    if (!user) {
      user = await User.findOne({ phone: '1234567890' })
      if (!user) {
        user = await User.create({
          name: 'John Doe',
          phone: '1234567890',
          googleId: 'mock-google-12345',
          loyaltyPoints: 320,
        })
      }
    }

    const newOrder = await Order.create({
      userId: user._id,
      items,
      totalAmount,
      status: status || 'Pending',
    })

    for (const item of items) {
      const inv = await Inventory.findOne({ productId: item.productId })
      if (inv) {
        inv.stockQuantity = Math.max(0, inv.stockQuantity - item.quantity)
        await inv.save()
      }
    }

    return res.status(201).json({ success: true, data: newOrder })
  } catch (error: any) {
    console.error('Error creating order:', error)
    return res.status(500).json({ success: false, error: error.message || 'Server error' })
  }
}
