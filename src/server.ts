import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { dbConnect } from './config/db'
import authRoutes from './routes/authRoutes'
import productRoutes from './routes/productRoutes'
import orderRoutes from './routes/orderRoutes'
import adminRoutes from './routes/adminRoutes'
import { errorHandler } from './middlewares/error'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'AtoZ Supplements Backend API is running' })
})

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminRoutes)

// Error Handler
app.use(errorHandler)

async function startServer() {
  try {
    await dbConnect()
    console.log('Database connected successfully')

    const startListen = (port: number) => {
      const server = app.listen(port, () => {
        console.log(`Backend server running on http://localhost:${port}`)
      })

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.warn(`Port ${port} is already in use. Retrying on port ${port + 1}...`)
          startListen(port + 1)
        } else {
          console.error('Server error:', error)
          process.exit(1)
        }
      })
    }
    const initialPort = Number(PORT) || 5000
    startListen(initialPort)
  } catch (error: any) {
    console.error('Failed to start backend:', error)
    process.exit(1)
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
  process.exit(1)
})

startServer()
