import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";

export interface TokenPayload {
  id: number;
  email: string;
  username: string;
  is_host: boolean;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare password with hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(user: {
  id: number;
  email: string;
  username: string;
  is_host?: boolean;
}): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      is_host: user.is_host || false,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get current user from cookies (for server components)
 */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return null;

  return verifyToken(token);
}

/**
 * Get user from Authorization header (for API routes)
 */
export function getUserFromHeader(
  authHeader: string | null
): TokenPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  return verifyToken(token);
}
