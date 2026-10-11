import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';

const envPath = path.join('D:/Drone/Drone-Navigation-Dashboard-/backend', '.env');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const i = line.indexOf('=');
  env[line.slice(0, i)] = line.slice(i + 1);
}

const client = new MongoClient(env.MONGO_URI);

async function main() {
  await client.connect();
  const db = client.db('crack_detection');
  const detections = db.collection('detections');
  const files = db.collection('detection_images.files');

  const fileDocs = await files.find({}, { projection: { _id: 1, filename: 1 } }).toArray();
  const nameMap = new Map();

  for (const file of fileDocs) {
    const key = String(file.filename || '').trim();
    if (!key) continue;
    nameMap.set(key, String(file._id));
  }

  let updated = 0;
  let skipped = 0;

  const cursor = detections.find({});
  for await (const doc of cursor) {
    const imagePath = doc.image_path || '';
    const imageName = doc.image_name || '';
    let matchedId = doc.image_id || null;

    if (matchedId) {
      skipped += 1;
      continue;
    }

    const possibleNames = [];
    if (imageName) possibleNames.push(imageName);
    if (imagePath) {
      possibleNames.push(path.basename(imagePath));
      possibleNames.push(imagePath.split('/').pop());
      possibleNames.push(imagePath.split('\\').pop());
    }

    const uniqueNames = [...new Set(possibleNames.filter(Boolean))];
    const match = uniqueNames.find((name) => nameMap.has(name));

    if (match) {
      matchedId = nameMap.get(match);
      await detections.updateOne(
        { _id: doc._id },
        {
          $set: {
            image_id: matchedId,
            image_name: match,
            image_url: `/api/defects/image/${matchedId}`,
          },
        }
      );
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(JSON.stringify({ updated, skipped, gridFsFiles: fileDocs.length }, null, 2));
}

try {
  await main();
} finally {
  await client.close();
}
