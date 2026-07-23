import mongoose, { Schema, model, Document } from 'mongoose'

export interface IDistributor extends Document {
  name: string
  contactEmail: string
  contactPhone: string
  address: string
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
    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.Distributor || model<IDistributor>('Distributor', DistributorSchema)
