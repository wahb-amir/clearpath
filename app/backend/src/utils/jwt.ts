import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { env } from "../config/env";
import crypto from "crypto";

// Load keys - Priority: env vars (HF Spaces) > filesystem > auto-generation
// Using env vars prevents token invalidation on every rebuild/deploy.
let privateKey = "";
let publicKey = "";

// Check if keys are provided via environment variables (for HF Spaces)
if (env.JWT_PRIVATE_KEY && env.JWT_PUBLIC_KEY) {
  privateKey = env.JWT_PRIVATE_KEY;
  publicKey = env.JWT_PUBLIC_KEY;
  console.log("✅ Loaded RS256 key pair from environment variables");
} else {
  // Fallback to filesystem-based keys
  const keysDir = path.resolve(__dirname, "../../.keys");
  const privateKeyPath = path.join(keysDir, "private.pem");
  const publicKeyPath = path.join(keysDir, "public.pem");

  try {
    privateKey = fs.readFileSync(privateKeyPath, "utf8");
    publicKey = fs.readFileSync(publicKeyPath, "utf8");
    console.log("✅ Loaded RS256 key pair from filesystem at", keysDir);
  } catch (e) {
    // Auto-generate the RS256 key pair at first boot. This is critical
    // for ephemeral environments (e.g. Hugging Face Spaces) where the
    // filesystem is recreated on every restart and `scripts/generate-keys.js`
    // cannot be run manually.
    try {
      if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
      }
      const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync(
        "rsa",
        {
          modulusLength: 2048,
          publicKeyEncoding: { type: "spki", format: "pem" },
          privateKeyEncoding: { type: "pkcs8", format: "pem" },
        },
      );
      fs.writeFileSync(publicKeyPath, pub);
      fs.writeFileSync(privateKeyPath, priv);
      publicKey = pub;
      privateKey = priv;
      console.log("✅ Generated RS256 key pair on startup at", keysDir);
    } catch (genErr) {
      console.warn(
        '⚠️ RS256 keys not found and auto-generation failed. Run "node scripts/generate-keys.js" first.',
      );
      console.warn(genErr);
    }
  }
}

const KID = "key-1"; // Key ID for rotation

export const signAccessToken = (userId: string, sessionId: string) => {
  return jwt.sign(
    { sub: userId, sid: sessionId },
    privateKey as jwt.Secret,
    {
      algorithm: "RS256",
      expiresIn: env.ACCESS_TOKEN_EXPIRY,
      keyid: KID,
    } as jwt.SignOptions,
  );
};

export const verifyAccessToken = (token: string) => {
  try {
    const result = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    }) as jwt.JwtPayload;

    return result;
  } catch (err) {
    console.error("Token verification failed:", err);
    throw new Error("Invalid or expired token");
  }
};

export const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString("hex");
};

export const getJwks = () => {
  // Simplistic JWKS representation of the public key
  // Normally you'd convert the PEM to JWK format (e.g. using 'pem-jwk' or 'node-jose')
  // We'll provide a basic mock or just the PEM if requested
  return {
    keys: [
      {
        kty: "RSA",
        alg: "RS256",
        use: "sig",
        kid: KID,
        // In a real system, you'd extract n and e from the PEM
        // For simplicity, we just provide the PEM in the x5c field
        x5c: [
          publicKey
            .replace("-----BEGIN PUBLIC KEY-----\n", "")
            .replace("\n-----END PUBLIC KEY-----\n", "")
            .replace(/\n/g, ""),
        ],
      },
    ],
  };
};

export const getPublicKeyPem = () => publicKey;
