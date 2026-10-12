import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateDrone } from './authenticateDrone.js';

const droneId = 'DRONE001';
const token = 'a'.repeat(64);

const runMiddleware = (headers, body) => {
  let statusCode;
  let responseBody;
  let nextCalled = false;
  const req = { headers, body };
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

  authenticateDrone(req, res, () => {
    nextCalled = true;
  });

  return { req, statusCode, responseBody, nextCalled };
};

test('authenticates a matching drone ID and token', () => {
  const previousCredentials = process.env.DRONE_CREDENTIALS;
  process.env.DRONE_CREDENTIALS = JSON.stringify({ [droneId]: token });

  try {
    const result = runMiddleware(
      { 'x-drone-id': droneId, 'x-drone-token': token },
      { camera_id: droneId }
    );

    assert.equal(result.nextCalled, true);
    assert.deepEqual(result.req.drone, { id: droneId });
  } finally {
    if (previousCredentials === undefined) delete process.env.DRONE_CREDENTIALS;
    else process.env.DRONE_CREDENTIALS = previousCredentials;
  }
});

test('rejects invalid drone tokens', () => {
  const previousCredentials = process.env.DRONE_CREDENTIALS;
  process.env.DRONE_CREDENTIALS = JSON.stringify({ [droneId]: token });

  try {
    const result = runMiddleware(
      { 'x-drone-id': droneId, 'x-drone-token': 'b'.repeat(64) },
      { drone_id: droneId }
    );

    assert.equal(result.statusCode, 401);
    assert.deepEqual(result.responseBody, { error: 'Invalid drone credentials' });
    assert.equal(result.nextCalled, false);
  } finally {
    if (previousCredentials === undefined) delete process.env.DRONE_CREDENTIALS;
    else process.env.DRONE_CREDENTIALS = previousCredentials;
  }
});

test('rejects a body drone ID that differs from the authenticated ID', () => {
  const previousCredentials = process.env.DRONE_CREDENTIALS;
  process.env.DRONE_CREDENTIALS = JSON.stringify({ [droneId]: token });

  try {
    const result = runMiddleware(
      { 'x-drone-id': droneId, 'x-drone-token': token },
      { camera_id: 'DRONE002' }
    );

    assert.equal(result.statusCode, 403);
    assert.equal(result.nextCalled, false);
  } finally {
    if (previousCredentials === undefined) delete process.env.DRONE_CREDENTIALS;
    else process.env.DRONE_CREDENTIALS = previousCredentials;
  }
});
