import { Router } from 'express';
import auth from './auth.js';
import donations from './donations.js';
import requests from './requests.js';
import pickups from './pickups.js';
import * as m from '../controllers/misc.js';
import * as rec from '../controllers/recurring.js';
import * as an from '../controllers/analytics.js';
import * as ad from '../controllers/admin.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import * as v from '../validators/index.js';

const api = Router();
api.get('/health', m.health);
api.use(apiLimiter);
api.use('/auth', auth);
api.use('/donations', donations);
api.use('/donation-requests', requests);
api.use('/pickups', pickups);
api.get('/categories', m.categories);
api.get('/analytics/public', an.publicStats);
api.get('/geo/search', authenticate, m.geocode);

// users
const users = Router(); users.use(authenticate);
users.patch('/me', validate(v.profileSchema), m.updateProfile);
users.post('/me/password', validate(v.passwordChangeSchema), m.changePassword);
users.get('/volunteers', authorize('donor', 'admin'), m.volunteers);
api.use('/users', users);

// organizations
const orgs = Router(); orgs.use(authenticate, authorize('ngo'));
orgs.get('/me', m.myOrg); orgs.put('/me', validate(v.orgSchema), m.saveOrg);
api.use('/organizations', orgs);

// notifications
const notes = Router(); notes.use(authenticate);
notes.get('/', m.listNotifications); notes.get('/unread-count', m.unreadCount); notes.patch('/read-all', m.markAllRead); notes.patch('/:id/read', validate(v.idParam, 'params'), m.markRead);
api.use('/notifications', notes);

// recurring donations
const rc = Router(); rc.use(authenticate, authorize('donor'));
const id = validate(v.idParam, 'params');
rc.get('/', rec.list); rc.post('/', validate(v.recurringSchema), rec.create); rc.put('/:id', id, validate(v.recurringSchema), rec.update);
rc.post('/:id/pause', id, rec.setStatus('paused', 'Schedule paused')); rc.post('/:id/resume', id, rec.setStatus('active', 'Schedule resumed')); rc.post('/:id/cancel', id, rec.setStatus('cancelled', 'Schedule cancelled'));
rc.get('/:id/generated', id, rec.generated);
api.use('/recurring-donations', rc);

// reports
const rp = Router(); rp.use(authenticate, authorize('donor', 'ngo', 'volunteer'));
rp.post('/', validate(v.reportSchema), m.createReport);
api.use('/reports', rp);

// analytics
const a = Router(); a.use(authenticate);
a.get('/me', an.mine); a.get('/admin', authorize('admin'), an.admin);
api.use('/analytics', a);

// admin
const adm = Router(); adm.use(authenticate, authorize('admin'));
adm.get('/users', ad.users); adm.post('/users/:id/suspend', id, ad.setUserStatus('suspended')); adm.post('/users/:id/reactivate', id, ad.setUserStatus('active'));
adm.get('/organizations', ad.organizations); adm.post('/organizations/:id/decision', id, ad.verifyOrg);
adm.get('/donations', ad.donations); adm.post('/donations/:id/suspend', id, ad.suspendDonation(true)); adm.post('/donations/:id/unsuspend', id, ad.suspendDonation(false)); adm.post('/donations/:id/reject', id, ad.rejectDonation);
adm.get('/requests', ad.requests); adm.get('/pickups', ad.pickups);
adm.get('/reports', ad.reports); adm.post('/reports/:id/resolve', id, ad.resolveReport);
adm.get('/audit-logs', ad.auditLogs);
adm.get('/categories', ad.adminCategories); adm.post('/categories', validate(v.categorySchema), ad.saveCategory); adm.put('/categories/:id', id, validate(v.categorySchema), ad.saveCategory);
adm.get('/settings', ad.getSettingsHandler); adm.put('/settings', validate(v.settingsSchema), ad.saveSettings);
api.use('/admin', adm);

export default api;
