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
app.use(cors({
  origin: (origin, callback) => {
    // Reflect request origin dynamically to allow credentials from any origin (e.g. dev ports)
    callback(null, true)
  },
  credentials: true
}))
app.use(express.json())

// Database connection middleware (critical for serverless / Vercel cold starts)
// This ensures the database is connected lazily on incoming requests and the connection
// is resolved and cached, without blocking the serverless function's initial cold boot.
app.use(async (req, res, next) => {
  try {
    await dbConnect()
    next()
  } catch (error) {
    console.error('Database connection middleware error:', error)
    res.status(500).json({ error: 'Database connection failed' })
  }
})

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

// Run the standalone HTTP server only when running locally (not in the Vercel serverless environment)
if (process.env.VERCEL !== '1') {
  async function startServer() {
    try {
      await dbConnect()
      console.log('Database connected successfully (local startup)')

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
}

// Export the Express app as default for Vercel Serverless Function configuration
export default app
