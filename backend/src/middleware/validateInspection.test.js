import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInspection } from './validateInspection.js';

const runMiddleware = (body) => {
  let statusCode;
  let responseBody;
  let nextCalled = false;
  const req = { body };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      responseBody = value;
      return this;
    },
  };

  validateInspection(req, res, () => {
    nextCalled = true;
  });

  return { statusCode, responseBody, nextCalled };
};

test('returns field-specific errors for invalid inspection data', () => {
  const result = runMiddleware({
    drone_id: ' ',
    battery_level: 101,
    latitude: -91,
    longitude: 'invalid',
  });

  assert.equal(result.statusCode, 422);
  assert.deepEqual(Object.keys(result.responseBody.errors), [
    'drone_id',
    'battery_level',
    'latitude',
    'longitude',
  ]);
  assert.equal(result.nextCalled, false);
});

test('passes valid inspection data to the next middleware', () => {
  const result = runMiddleware({
    drone_id: 'drone-1',
    battery_level: 75,
    latitude: 6.9271,
    longitude: 79.8612,
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, undefined);
});

test('rejects non-object request bodies with 422 field errors', () => {
  const result = runMiddleware(null);

  assert.equal(result.statusCode, 422);
  assert.deepEqual(Object.keys(result.responseBody.errors), [
    'drone_id',
    'battery_level',
    'latitude',
    'longitude',
  ]);
});
