import { Router } from 'express';
import * as c from '../controllers/requests.js';
import { authenticate, authorize, requireVerifiedEmail } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, reasonSchema, requestCreateSchema } from '../validators/index.js';

const r = Router(); r.use(authenticate);
const id = validate(idParam, 'params');
r.get('/', authorize('donor', 'ngo'), c.list);
r.post('/', authorize('ngo'), requireVerifiedEmail, validate(requestCreateSchema), c.create);
r.get('/:id', id, authorize('donor', 'ngo', 'admin'), c.getOne);
r.patch('/:id/accept', id, authorize('donor'), c.accept);
r.patch('/:id/reject', id, authorize('donor'), validate(reasonSchema), c.reject);
r.patch('/:id/ready', id, authorize('donor'), c.markReady);
r.patch('/:id/handover', id, authorize('donor'), c.confirmHandover);
r.patch('/:id/cancel', id, authorize('ngo'), c.cancel);
r.patch('/:id/receipt', id, authorize('ngo'), c.confirmReceipt);
export default r;
