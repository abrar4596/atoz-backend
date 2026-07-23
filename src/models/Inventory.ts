import mongoose, { Schema, model, Document, Types } from 'mongoose'
import { IProduct } from './Product'

export enum InventoryStatus {
  IN_STOCK = 'In_Stock',
  LOW_STOCK = 'Low_Stock',
  OUT_OF_STOCK = 'Out_Of_Stock',
}

export interface IInventory extends Document {
  productId: Types.ObjectId | IProduct
  batchNumber: string
  stockQuantity: number
  expiryDate: Date
  status: InventoryStatus
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
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    status: {
      type: String,
      enum: Object.values(InventoryStatus),
      default: InventoryStatus.OUT_OF_STOCK,
    },
  },
  {
    timestamps: true,
  }
)

// Middleware to update status based on stockQuantity
function updateStatus(doc: IInventory) {
  if (doc.stockQuantity >= 3) {
    doc.status = InventoryStatus.IN_STOCK
  } else if (doc.stockQuantity > 0) {
    doc.status = InventoryStatus.LOW_STOCK
  } else {
    doc.status = InventoryStatus.OUT_OF_STOCK
  }
}

InventorySchema.pre('save', function () {
  updateStatus(this)
})

InventorySchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as any
  if (update.stockQuantity !== undefined) {
    let status: InventoryStatus
    if (update.stockQuantity >= 3) {
      status = InventoryStatus.IN_STOCK
    } else if (update.stockQuantity > 0) {
      status = InventoryStatus.LOW_STOCK
    } else {
      status = InventoryStatus.OUT_OF_STOCK
    }
    this.setUpdate({ ...update, status })
  }
})

InventorySchema.pre('updateOne', function () {
  const update = this.getUpdate() as any
  if (update.stockQuantity !== undefined) {
    let status: InventoryStatus
    if (update.stockQuantity >= 3) {
      status = InventoryStatus.IN_STOCK
    } else if (update.stockQuantity > 0) {
      status = InventoryStatus.LOW_STOCK
    } else {
      status = InventoryStatus.OUT_OF_STOCK
    }
    this.setUpdate({ ...update, status })
  }
})

InventorySchema.index({ productId: 1 })
InventorySchema.index({ status: 1 })

export default mongoose.models.Inventory || model<IInventory>('Inventory', InventorySchema)
