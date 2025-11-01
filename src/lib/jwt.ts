import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

export function signAdminJWT(adminUserId: string): string {
  return jwt.sign({ sub: adminUserId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

export function verifyAdminJWT(token: string): { sub: string } {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  return decoded as { sub: string };
}


