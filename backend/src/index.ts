import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import authRoutes from './routes/auth';
import { supabase } from './lib/supabase';

const app = express();
const port = env.PORT || 5000;

// Trust proxy is essential when behind Next.js or a load balancer
// so that req.ip gets the correct client IP instead of the proxy's IP
app.set('trust proxy', 1);

// Request logging
app.use(morgan('dev'));

app.use(cors({
  origin: 'http://localhost:3000', // You can swap this out with env.FRONTEND_URL later if needed
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

/**
 * Verify Supabase Connectivity on Startup
 * Runs a lightweight query to ensure the backend can talk to your Postgres instance.
 */
async function verifyDatabaseConnection() {
  try {
    // Select a single column with a limit of 1 to minimize data transfer overhead
    const { error } = await supabase.from('users').select('id').limit(1);
    
    if (error) {
      // PGRST116 means "JSON object requested, but 0 rows returned". 
      // If the table is empty, this error code confirms the table exists and connection is valid.
      if (error.code !== 'PGRST116') throw error;
    }
    
    console.log('✅ PostgreSQL Connection verified successfully via Supabase API.');
  } catch (err: any) {
    console.error('❌ Failed to connect to Supabase/PostgreSQL on startup:');
    console.error(err?.message || err);
    process.exit(1); // Crash the process so your process manager (e.g., PM2/Docker) can handle it
  }
}

// Fire the connection check
verifyDatabaseConnection();

// Routes
app.use('/auth', authRoutes);

app.get('/api/health', (req, res) => {
  console.log('GET /api/health');
  res.json({ status: 'OK', message: 'ClearPath Backend is running' });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});