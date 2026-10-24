import { Router } from 'express';
import * as c from '../controllers/donations.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireImage, upload } from '../middleware/upload.js';
import { donationBase, donationUpdateSchema, idParam } from '../validators/index.js';

const r = Router();
const donor = [authenticate, authorize('donor', 'admin')];
r.get('/', optionalAuth, c.list);
r.get('/mine', authenticate, authorize('donor'), c.mine);
r.post('/', ...donor, validate(donationBase), c.create);
r.get('/:id', validate(idParam, 'params'), optionalAuth, c.getOne);
r.patch('/:id', ...donor, validate(idParam, 'params'), validate(donationUpdateSchema), c.update);
r.post('/:id/publish', ...donor, validate(idParam, 'params'), c.publish);
r.post('/:id/cancel', ...donor, validate(idParam, 'params'), c.cancel);
r.post('/:id/image', ...donor, validate(idParam, 'params'), upload, requireImage, c.uploadPhoto);
r.delete('/:id/image', ...donor, validate(idParam, 'params'), c.removePhoto);
export default r;
