import { Router, Request, Response } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { User } from '../models/User';
import { signAccessToken, generateRefreshToken, getJwks } from '../utils/jwt';
import { createSession, refreshSession, revokeSession } from '../services/sessionService';
import { requireAuth, AuthRequest } from '../middlewares/auth';
import { rateLimiter } from '../middlewares/rateLimiter';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const isProd = process.env.NODE_ENV === 'production';

const authCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ('none' as const) : ('lax' as const),
  path: '/',
};

const setAuthCookies = (
  res: Response,
  params: {
    accessToken: string;
    refreshToken: string;
    sid: string;
  }
) => {
  res.cookie('accessToken', params.accessToken, authCookieOptions);
  res.cookie('refreshToken', params.refreshToken, authCookieOptions);
  res.cookie('sid', params.sid, authCookieOptions);
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', { ...authCookieOptions });
  res.clearCookie('refreshToken', { ...authCookieOptions });
  res.clearCookie('sid', { ...authCookieOptions });
};

router.post('/register', rateLimiter, async (req: Request, res: Response) => {
  try {
    const { fullName, email, password } = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email }).select('+passwordHash');
    if (existingUser) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await argon2.hash(password);

    const user = await User.create({
      fullName,
      email,
      passwordHash,
    });

    const refreshToken = generateRefreshToken();
    const deviceMeta =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : 'Unknown Device';

    const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';

    const { sid } = await createSession(
      user._id.toString(),
      refreshToken,
      deviceMeta,
      ip
    );

    const accessToken = signAccessToken(user._id.toString(), sid);

    setAuthCookies(res, {
      accessToken,
      refreshToken,
      sid,
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ error: 'Bad Request' });
  }
});

router.post('/login', rateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const refreshToken = generateRefreshToken();
    const deviceMeta =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : 'Unknown Device';

    const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';

    const { sid } = await createSession(
      user._id.toString(),
      refreshToken,
      deviceMeta,
      ip
    );

    const accessToken = signAccessToken(user._id.toString(), sid);

    setAuthCookies(res, {
      accessToken,
      refreshToken,
      sid,
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: 'Bad Request' });
  }
});

router.post('/refresh', rateLimiter, async (req: Request, res: Response) => {
  try {
    const sid = req.cookies?.sid;
    const refreshToken = req.cookies?.refreshToken;

    if (!sid || !refreshToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const newRefreshToken = generateRefreshToken();
    const { newSid, userId } = await refreshSession(
      sid,
      refreshToken,
      newRefreshToken
    );

    const accessToken = signAccessToken(userId, newSid);

    setAuthCookies(res, {
      accessToken,
      refreshToken: newRefreshToken,
      sid: newSid,
    });

    res.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Refresh error:', error?.message || error);
    clearAuthCookies(res);
    res.status(401).json({ error: 'Unauthorized or token reused' });
  }
});

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sid = req.user?.sid;

    if (sid) {
      await revokeSession(sid);
    }

    clearAuthCookies(res);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/.well-known/jwks.json', (_req: Request, res: Response) => {
  res.json(getJwks());
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  res.json({
    message: 'You are authenticated!',
    user: req.user,
  });
});

export default router;