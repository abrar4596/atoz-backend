import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dbConnect from '../lib/dbConnect';
import productsRouter from './routes/products';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
dbConnect().catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'AtoZ Supplements Backend API is running' });
});
app.use('/api/products', productsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
