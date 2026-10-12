import { createHash, timingSafeEqual } from 'node:crypto';

const getDroneCredentials = () => {
  const configuredCredentials = process.env.DRONE_CREDENTIALS;
  if (!configuredCredentials) return null;

  const credentials = JSON.parse(configuredCredentials);
  if (
    !credentials ||
    typeof credentials !== 'object' ||
    Array.isArray(credentials) ||
    Object.keys(credentials).length === 0 ||
    Object.values(credentials).some((token) => typeof token !== 'string' || token.length < 32)
  ) {
    throw new Error('DRONE_CREDENTIALS must map drone IDs to tokens of at least 32 characters');
  }

  return credentials;
};

const hashToken = (token) => createHash('sha256').update(token).digest();

export const authenticateDrone = (req, res, next) => {
  let credentials;
  try {
    credentials = getDroneCredentials();
  } catch (error) {
    console.error('Invalid drone authentication configuration:', error.message);
    return res.status(500).json({ error: 'Drone authentication is misconfigured' });
  }

  if (!credentials) {
    return res.status(503).json({ error: 'Drone authentication is not configured' });
  }

  const droneId = req.headers['x-drone-id'];
  const token = req.headers['x-drone-token'];
  const expectedToken = typeof droneId === 'string' ? credentials[droneId] : undefined;

  if (typeof token !== 'string' || typeof expectedToken !== 'string') {
    return res.status(401).json({ error: 'Invalid drone credentials' });
  }

  const suppliedHash = hashToken(token);
  const expectedHash = hashToken(expectedToken);
  if (!timingSafeEqual(suppliedHash, expectedHash)) {
    return res.status(401).json({ error: 'Invalid drone credentials' });
  }

  const bodyDroneIds = [req.body?.drone_id, req.body?.camera_id]
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim());
  if (bodyDroneIds.length === 0) {
    return res.status(422).json({
      errors: { drone_id: 'drone_id or camera_id is required and must match the authenticated drone' },
    });
  }
  if (bodyDroneIds.some((id) => id !== droneId)) {
    return res.status(403).json({ error: 'Request drone ID does not match authenticated drone' });
  }

  req.drone = { id: droneId };
  return next();
};

export default authenticateDrone;
