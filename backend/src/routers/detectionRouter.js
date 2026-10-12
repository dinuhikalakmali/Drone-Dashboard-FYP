import express from 'express';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import Defect from '../models/Detection.js';
import { authenticateDrone } from '../middleware/authenticateDrone.js';

const router = express.Router();

const parseDateValue = (value) => {
    if (!value) return null;

    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
};

const isWithinDateRange = (value, fromDate, toDate) => {
    const parsedDate = parseDateValue(value);
    if (!parsedDate) return false;

    return parsedDate >= fromDate && parsedDate <= toDate;
};

const getGridFsBucket = () => {
    if (!mongoose.connection.db) {
        throw new Error('Database connection is not available');
    }

    return new GridFSBucket(mongoose.connection.db, { bucketName: 'detection_images' });
};

const resolveLegacyGridfsFile = async (lookup) => {
    if (!lookup || !mongoose.connection.db) return null;

    const sanitized = decodeURIComponent(String(lookup)).trim();
    if (!sanitized) return null;

    const fileCollection = mongoose.connection.db.collection('detection_images.files');

    const query = { $or: [{ filename: sanitized }, { filename: sanitized.split('/').pop()?.split('\\').pop() }] };
    const fileMeta = await fileCollection.findOne(query);

    if (fileMeta) return fileMeta;

    const plainName = sanitized.split('/').pop()?.split('\\').pop();
    if (plainName && plainName !== sanitized) {
        return fileCollection.findOne({ filename: plainName });
    }

    return null;
};

const attachGridFsImageIds = async (defects) => {
    if (!mongoose.connection.db) return defects;

    const imageIds = defects.map((defect) => {
        const value = defect.image_id;
        return value && ObjectId.isValid(String(value)) ? new ObjectId(String(value)) : null;
    });
    const uniqueIds = [...new Map(imageIds.filter(Boolean).map((id) => [id.toHexString(), id])).values()];
    const chunkIds = uniqueIds.length
        ? await mongoose.connection.db
            .collection('detection_images.chunks')
            .find({ files_id: { $in: uniqueIds } }, { projection: { files_id: 1 } })
            .toArray()
        : [];
    const availableIds = new Set(chunkIds.map((chunk) => String(chunk.files_id)));

    return defects.map((defect, index) => {
        const result = defect.toObject();
        const imageId = imageIds[index];
        const imageAvailable = Boolean(imageId && availableIds.has(imageId.toHexString()));

        result.image_id = imageAvailable ? imageId.toHexString() : null;
        result.image_available = imageAvailable;
        return result;
    });
};

router.get('/count', async (req, res) => {
    try {
        const count = await Defect.countDocuments({});
        res.status(200).json({ success: true, count });
    } catch (error) {
        console.error('Error fetching defect count:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

const streamGridFsImage = async (req, res) => {
    try {
        const { imageId } = req.params;
        const lookup = decodeURIComponent(String(imageId || '')).trim();

        let fileMeta = null;
        let streamId = null;

        if (lookup && ObjectId.isValid(lookup)) {
            fileMeta = await mongoose.connection.db
                .collection('detection_images.files')
                .findOne({ _id: new ObjectId(lookup) });
            streamId = lookup;
        } else if (lookup) {
            fileMeta = await resolveLegacyGridfsFile(lookup);
            streamId = fileMeta ? String(fileMeta._id) : null;
        }

        if (!fileMeta || !streamId) {
            return res.status(404).json({ success: false, message: 'Image not found' });
        }

        const fileId = new ObjectId(streamId);
        const imageChunk = await mongoose.connection.db
            .collection('detection_images.chunks')
            .findOne({ files_id: fileId }, { projection: { _id: 1 } });

        if (!imageChunk) {
            return res.status(404).json({ success: false, message: 'Image data not found' });
        }

        const bucket = getGridFsBucket();
        res.set('Content-Type', fileMeta.contentType || 'image/jpeg');

        const downloadStream = bucket.openDownloadStream(fileId);
        downloadStream.on('error', () => {
            res.status(404).json({ success: false, message: 'Image not found' });
        });

        downloadStream.pipe(res);
    } catch (error) {
        console.error('Error fetching image from GridFS:', error);
        res.status(500).json({ success: false, message: 'Error fetching image', error: error.message });
    }
};

router.get('/image/:imageId', streamGridFsImage);
router.get('/detection-image/:imageId', streamGridFsImage);
router.get('/images/:imageId', streamGridFsImage);

router.get('/datapdf', async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        let query = {};
        let defects = await Defect.find(query).sort({ detected_time: -1, timestamp: -1, time: -1 });

        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);

            defects = defects.filter((item) => {
                return [
                    item.detected_time,
                    item.timestamp,
                    item.time,
                    item.detectedTime,
                    item.createdAt,
                ].some((value) => isWithinDateRange(value, startDate, endDate));
            });
        }

        const defectsWithImageIds = await attachGridFsImageIds(defects);
        res.status(200).json({ success: true, data: defectsWithImageIds });
    } catch (error) {
        console.error('Error fetching defects for PDF:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const defects = await Defect.find({}).sort({ detected_time: -1, timestamp: -1, time: -1 });
        res.status(200).json({ success: true, data: defects });
    } catch (error) {
        console.error('Error fetching defects:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

const createDetection = async (req, res) => {
    try {
        const defect = await Defect.create(req.body);
        res.status(201).json({
            success: true,
            message: 'Defect created',
            data: defect,
        });
    } catch (error) {
        console.error('Error creating defect:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating defect',
            error: error.message,
        });
    }
};

router.post('/drone', authenticateDrone, createDetection);
router.post('/', createDetection);

export default router;