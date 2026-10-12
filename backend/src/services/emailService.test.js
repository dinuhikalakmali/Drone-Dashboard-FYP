import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import Defect from '../models/defectsModel.js';
import { sendHighSeverityAlert } from './emailService.js';

test('suppresses an alert when the defect was emailed within five minutes', async (t) => {
  const defectId = '507f1f77bcf86cd799439011';
  const claimAlert = t.mock.method(Defect, 'findOneAndUpdate', async () => null);
  const startedAt = Date.now();

  const result = await sendHighSeverityAlert(
    { _id: defectId, title: 'Test defect' },
    [{ email: 'engineer@example.com' }]
  );

  assert.deepEqual(result, { sent: false, reason: 'throttled' });
  assert.equal(claimAlert.mock.callCount(), 1);

  const [filter, update, options] = claimAlert.mock.calls[0].arguments;
  assert.equal(filter._id, defectId);
  assert.equal(filter.$or[0].emailAlertSentAt.$exists, false);

  const cooldownCutoff = filter.$or[1].emailAlertSentAt.$lte;
  assert.ok(cooldownCutoff instanceof Date);
  assert.ok(Math.abs(cooldownCutoff.getTime() - (startedAt - 5 * 60 * 1000)) < 1000);
  assert.ok(update.$set.emailAlertSentAt instanceof Date);
  assert.deepEqual(options, { new: false });
});
