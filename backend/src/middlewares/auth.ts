import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    sid: string;
  };
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.accessToken;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub as string,
      sid: payload.sid as string,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};