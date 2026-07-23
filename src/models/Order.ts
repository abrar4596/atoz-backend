import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IOrderItem {
  productId: string
  name: string
  brand: string
  flavour?: string
  quantity: number
  price: number
}

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId
  items: IOrderItem[]
  totalAmount: number
  status: 'Pending' | 'Processing' | 'Ready for Pickup' | 'Out for Delivery' | 'Delivered'
  createdAt: Date
  updatedAt: Date
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  brand: { type: String, required: true },
  flavour: { type: String },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
})

const OrderSchema = new Schema<IOrder>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: { type: [OrderItemSchema], required: true },
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Processing', 'Ready for Pickup', 'Out for Delivery', 'Delivered'],
    default: 'Pending',
    required: true
  }
}, {
  timestamps: true
})

const OrderModel: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema)
export { OrderModel as Order }
export default OrderModel
