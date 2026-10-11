# GridFS image retrieval guide

## 1) Understand the mismatch

The two collections are not the same object:

- `crack_detection.detections` stores detection metadata
- `crack_detection.detection_images.files` stores the image metadata
- `crack_detection.detection_images.chunks` stores the binary image bytes

A detection record stores the image relationship with `image_id`, not with the local `image_path` value.

`image_path` such as `uploads/frame_1791476131071.jpg` is only a local filesystem path from the inference script. It is not a valid URL for the browser or another machine.

---

## 2) Correct relationship

Example detection document:

```json
{
  "_id": "...",
  "camera_id": "DRONE001",
  "crack_type": "vertical_crack",
  "confidence": 0.4371168613433838,
  "severity": "Low",
  "timestamp": "2026-08-15 18:41:03",
  "image_id": "6ac7ed920327426429a60855",
  "image_name": "frame_1791476131071.jpg",
  "image_path": "uploads/frame_1791476131071.jpg"
}
```

The real image is loaded from GridFS using `image_id`:

```text
ObjectId("6ac7ed920327426429a60855")
  -> detection_images.files._id
  -> detection_images.chunks binary data
```

---

## 3) Backend API route

The backend now exposes this route:

```text
GET /api/defects/image/:imageId
GET /api/defects/detection-image/:imageId
```

Example:

```html
<img src="http://localhost:5000/api/defects/image/6ac7ed920327426429a60855" />
```

This reads the GridFS file using the MongoDB object id and streams the image bytes to the browser.

---

## 4) Date filtering fix

The report route was also failing because the stored dates were sometimes strings like:

```text
2026-08-15 18:41:03
```

while the backend was comparing them as native `Date` values. The fix converts and checks date values safely in JavaScript before returning the report rows.

Backend route:

```text
GET /api/defects/datapdf?fromDate=2026-08-01&toDate=2026-08-31
```

---

## 5) Frontend use

Use the GridFS id, not `image_path`:

```jsx
<img
  src={`http://localhost:5000/api/defects/image/${item.image_id}`}
  alt={item.image_name || 'Defect image'}
  style={{ maxWidth: 240 }}
/>
```

If `image_id` is missing, do not render the image and log a warning.

---

## 6) Atlas / MongoDB checklist

- `crack_detection` database
- GridFS bucket name: `detection_images`
- `detections` collection stores detection metadata
- `detection_images.files` stores file metadata
- `detection_images.chunks` stores binary bytes
- DB user must have read access on `crack_detection`
- Atlas network access must allow your dashboard server IP

---

## 7) Python Flask equivalent

```python
from flask import Flask, Response, abort
from pymongo import MongoClient
import gridfs
from bson import ObjectId

app = Flask(__name__)
db = MongoClient(MONGO_URI)["crack_detection"]
fs = gridfs.GridFS(db, collection="detection_images")

@app.route("/image/<image_id>")
def image(image_id):
    try:
        data = fs.get(ObjectId(image_id)).read()
    except Exception:
        abort(404)
    return Response(data, mimetype="image/jpeg")
```
