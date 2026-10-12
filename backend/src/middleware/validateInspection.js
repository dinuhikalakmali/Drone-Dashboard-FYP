const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export const validateInspection = (req, res, next) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const errors = {};

  if (typeof body.drone_id !== 'string' || !body.drone_id.trim()) {
    errors.drone_id = 'drone_id is required and must be a non-empty string';
  }

  if (!isFiniteNumber(body.battery_level) || body.battery_level < 0 || body.battery_level > 100) {
    errors.battery_level = 'battery_level must be a number between 0 and 100';
  }

  if (!isFiniteNumber(body.latitude) || body.latitude < -90 || body.latitude > 90) {
    errors.latitude = 'latitude must be a number between -90 and 90';
  }

  if (!isFiniteNumber(body.longitude) || body.longitude < -180 || body.longitude > 180) {
    errors.longitude = 'longitude must be a number between -180 and 180';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ errors });
  }

  next();
};
