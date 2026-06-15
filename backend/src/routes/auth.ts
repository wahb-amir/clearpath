import { Router, Request, Response } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { User } from '../models/User';
import { signAccessToken, generateRefreshToken, getJwks } from '../utils/jwt';
import { createSession, refreshSession, revokeSession } from '../services/sessionService';
import { requireAuth, AuthRequest } from '../middlewares/auth';
import { rateLimiter } from '../middlewares/rateLimiter';
import { env } from '../config/env';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/login', rateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // MOCK: Auto-create user if not exists for testing purposes,
    // IN PRODUCTION: You would just find and verify.
    let user = await User.findOne({ email });
    if (!user) {
      // Mock creation for ease of testing
      const passwordHash = await argon2.hash(password);
      user = await User.create({ email, passwordHash });
    } else {
      const valid = await argon2.verify(user.passwordHash, password);
      if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    }

    const refreshToken = generateRefreshToken();
    const deviceMeta = req.headers['user-agent'] || 'Unknown Device';
    const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';

    const { sid } = await createSession(user._id.toString(), refreshToken, deviceMeta, ip);
    const accessToken = signAccessToken(user._id.toString(), sid);

    res.json({
      accessToken,
      refreshToken,
      sid,
      expiresIn: env.ACCESS_TOKEN_EXPIRY,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: 'Bad Request' });
  }
});

const refreshSchema = z.object({
  sid: z.string(),
  refreshToken: z.string(),
});

router.post('/refresh', rateLimiter, async (req: Request, res: Response) => {
  try {
    const { sid, refreshToken } = refreshSchema.parse(req.body);

    const newRefreshToken = generateRefreshToken();
    const { newSid, userId } = await refreshSession(sid, refreshToken, newRefreshToken);

    const accessToken = signAccessToken(userId, newSid); 

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      sid: newSid,
    });
  } catch (error: any) {
    console.error('Refresh error:', error.message);
    res.status(401).json({ error: 'Unauthorized or token reused' });
  }
});

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sid = req.user?.sid;
    if (sid) {
      await revokeSession(sid);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/.well-known/jwks.json', (req: Request, res: Response) => {
  res.json(getJwks());
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  res.json({
    message: 'You are authenticated!',
    user: req.user,
  });
});

export default router;
