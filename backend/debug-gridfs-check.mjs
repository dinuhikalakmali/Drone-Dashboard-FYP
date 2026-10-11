import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

const envPath = path.join('D:/Drone/Drone-Navigation-Dashboard-/backend', '.env');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const i = line.indexOf('=');
  env[line.slice(0, i)] = line.slice(i + 1);
}

const client = new MongoClient(env.MONGO_URI);
try {
  await client.connect();
  const db = client.db('crack_detection');
  const docs = await db.collection('detections').find({}, {
    projection: {
      image_id: 1,
      image_name: 1,
      image_path: 1,
      crack_type: 1,
      severity: 1,
      detected_time: 1,
      timestamp: 1,
      camera_id: 1,
      _id: 1,
    },
  }).limit(3).toArray();

  console.log(JSON.stringify(docs, null, 2));
} finally {
  await client.close();
}
