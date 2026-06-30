import mongoose, { Schema, model, Document, Types } from 'mongoose'
import { IProduct } from './Product'

export enum InventoryStatus {
  IN_STOCK = 'In_Stock',
  LOW_STOCK = 'Low_Stock',
  OUT_OF_STOCK = 'Out_of_Stock',
}

export interface IInventory extends Document {
  productId: Types.ObjectId | IProduct
  batchNumber: string
  stockQuantity: number
  expiryDate: Date
  status: InventoryStatus
  isLowStock: boolean
  isExpiringSoon: boolean
  createdAt: Date
  updatedAt: Date
}

const InventorySchema = new Schema<IInventory>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    status: {
      type: String,
      required: [true, 'Inventory status is required'],
      enum: Object.values(InventoryStatus),
      default: InventoryStatus.IN_STOCK,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

InventorySchema.virtual('isLowStock').get(function (this: IInventory) {
  return this.stockQuantity < 3 && this.stockQuantity > 0
})

InventorySchema.virtual('isExpiringSoon').get(function (this: IInventory) {
  const now = new Date()
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  return this.expiryDate <= sixtyDaysFromNow && this.expiryDate > now
})

InventorySchema.pre('save', function () {
  if (this.stockQuantity === 0) {
    this.status = InventoryStatus.OUT_OF_STOCK
  } else if (this.stockQuantity < 3) {
    this.status = InventoryStatus.LOW_STOCK
  } else {
    this.status = InventoryStatus.IN_STOCK
  }
})

function updateStatusBasedOnStock(stockQuantity: number): InventoryStatus {
  if (stockQuantity === 0) {
    return InventoryStatus.OUT_OF_STOCK
  } else if (stockQuantity < 3) {
    return InventoryStatus.LOW_STOCK
  } else {
    return InventoryStatus.IN_STOCK
  }
}

InventorySchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as any
  if (update?.stockQuantity !== undefined) {
    const stockQuantity = typeof update.stockQuantity === 'number' ? update.stockQuantity : update.stockQuantity?.$set
    if (typeof stockQuantity === 'number') {
      this.set('status', updateStatusBasedOnStock(stockQuantity))
    }
  }
})

InventorySchema.pre('updateOne', function () {
  const update = this.getUpdate() as any
  if (update?.stockQuantity !== undefined) {
    const stockQuantity = typeof update.stockQuantity === 'number' ? update.stockQuantity : update.stockQuantity?.$set
    if (typeof stockQuantity === 'number') {
      this.set('status', updateStatusBasedOnStock(stockQuantity))
    }
  }
})

InventorySchema.pre('updateMany', function () {
  const update = this.getUpdate() as any
  if (update?.stockQuantity !== undefined) {
    const stockQuantity = typeof update.stockQuantity === 'number' ? update.stockQuantity : update.stockQuantity?.$set
    if (typeof stockQuantity === 'number') {
      this.set('status', updateStatusBasedOnStock(stockQuantity))
    }
  }
})

InventorySchema.index({ productId: 1 })
InventorySchema.index({ expiryDate: 1 })
InventorySchema.index({ status: 1 })

export default mongoose.models.Inventory || model<IInventory>('Inventory', InventorySchema)
