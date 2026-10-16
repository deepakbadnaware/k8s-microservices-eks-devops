import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { FRONTEND_URL } from './config/utils.js';
import authRouter from './routes/auth.js';
import postsRouter from './routes/posts.js';
import userRouter from './routes/user.js';
import errorMiddleware from './middlewares/error-middleware.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';

const app = express();

app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// 1. ADD MIDDLEWARE HERE: Start timing the request before it hits your routes
app.use(metricsMiddleware);

// 2. EXPOSE ENDPOINTS HERE: Before the 404 catch-all
app.get('/metrics', metricsHandler); 
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// API routes
app.use('/api/posts', postsRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

app.get('/', (req, res) => {
  res.send('Yay!! Backend of wanderlust app is now accessible');
});

// 3. CATCH-ALL MUST BE LAST: Only trigger 404 if no routes above matched
app.all('*', (req, res) => {
  res.status(404).json({
    status: 404,
    success: false,
    message: '!Oops page not found',
  });
});

// Error middleware should stay at the very bottom
app.use(errorMiddleware);

export default app;