import mongoose, { Schema, model, Document } from 'mongoose'

export interface IDistributor extends Document {
  name: string
  email: string
  phone: string
  moq?: number
  createdAt: Date
  updatedAt: Date
}

const DistributorSchema = new Schema<IDistributor>(
  {
    name: {
      type: String,
      required: [true, 'Distributor name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    moq: {
      type: Number,
      min: [1, 'MOQ must be at least 1'],
    },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.Distributor || model<IDistributor>('Distributor', DistributorSchema)
