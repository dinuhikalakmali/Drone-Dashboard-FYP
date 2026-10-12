import mongoose from 'mongoose';

const inspectionSchema = new mongoose.Schema({
  drone_id: {
    type: String,
    required: true,
    trim: true,
  },
  battery_level: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90,
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180,
  },
}, {
  timestamps: true,
  collection: 'inspections',
});

const Inspection =
  mongoose.models.Inspection ||
  mongoose.model('Inspection', inspectionSchema);

export default Inspection;
