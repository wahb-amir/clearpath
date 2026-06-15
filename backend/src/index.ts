import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import authRoutes from './routes/auth';

const app = express();
const port = env.PORT;

// Trust proxy is essential when behind Next.js or a load balancer
// so that req.ip gets the correct client IP instead of the proxy's IP
app.set('trust proxy', 1);

// Request logging
app.use(morgan('dev'));

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect(env.MONGODB_URI)
  .then(() => console.log('📦 Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

app.use('/auth', authRoutes);

app.get('/api/health', (req, res) => {
  console.log('GET /api/health');
  res.json({ status: 'OK', message: 'ClearPath Backend is running' });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});