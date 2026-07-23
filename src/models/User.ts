import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUser extends Document {
  name: string
  phone: string
  googleId?: string
  loyaltyPoints: number
  passwordHash?: string
  isAdmin: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true, trim: true },
    googleId: { type: String },
    loyaltyPoints: { type: Number, default: 0 },
    passwordHash: { type: String, select: false },
    isAdmin: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
)

const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
export { UserModel as User }
export default UserModel
