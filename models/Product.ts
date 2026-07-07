import mongoose, { Schema, model, Document, Types } from 'mongoose'
import { IDistributor } from './Distributor'

export enum ProductCategory {
  PROTEIN = 'Protein',
  PRE_WORKOUT = 'Pre-workout',
  VITAMINS = 'Vitamins',
  ACCESSORIES = 'Accessories',
}

export interface IProduct extends Document {
  name: string
  sku: string
  description: string
  price: number
  brand: string
  imageUrl: string
  category: ProductCategory
  flavourTags: string[]
  distributorId: Types.ObjectId | IDistributor
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      set: (v: number) => Math.round(v * 100) / 100,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: Object.values(ProductCategory),
    },
    flavourTags: {
      type: [String],
      default: [],
    },
    distributorId: {
      type: Schema.Types.ObjectId,
      ref: 'Distributor',
      required: [true, 'Distributor reference is required'],
    },
  },
  {
    timestamps: true,
  }
)

ProductSchema.index({ distributorId: 1 })

export default mongoose.models.Product || model<IProduct>('Product', ProductSchema)
