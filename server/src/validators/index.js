import { z } from 'zod';
import { UNITS } from '../utils/units.js';
import { isValidTimeZone } from '../utils/time.js';

const trimmed = (max, min = 1) => z.string().trim().min(min, 'This field is required').max(max);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const point = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const password = z.string().min(10, 'Use at least 10 characters').max(128)
  .regex(/[a-z]/, 'Include a lowercase letter').regex(/[A-Z]/, 'Include an uppercase letter').regex(/\d/, 'Include a number');

export const registerSchema = z.object({
  name: trimmed(80, 2),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password,
  role: z.enum(['donor', 'ngo', 'volunteer']), // admin can never be self-assigned
  phone: z.string().trim().max(30).optional(),
  organizationName: trimmed(140).optional(),
  businessName: trimmed(120).optional(),
}).strict();
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }).strict();
export const emailSchema = z.object({ email: z.string().trim().toLowerCase().email() }).strict();
export const tokenSchema = z.object({ token: z.string().min(10).max(200) }).strict();
export const resetSchema = z.object({ token: z.string().min(10).max(200), password }).strict();

export const profileSchema = z.object({
  name: trimmed(80, 2).optional(),
  phone: z.string().trim().max(30).optional(),
  business: z.object({ name: trimmed(120).optional(), type: z.enum(['restaurant', 'grocery', 'bakery', 'hotel', 'event', 'other']).optional(), address: z.string().max(250).optional(), description: z.string().max(600).optional() }).optional(),
  volunteer: z.object({
    bio: z.string().max(500).optional(), vehicle: z.enum(['none', 'bicycle', 'motorbike', 'car', 'van']).optional(), available: z.boolean().optional(),
    shareLocationConsent: z.boolean().optional(),
    availability: z.array(z.object({ day: z.number().int().min(0).max(6), from: hhmm, to: hhmm })).max(14).optional(),
  }).optional(),
}).strict(); // role/status/email cannot be changed here
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1), newPassword: password }).strict();

export const orgSchema = z.object({
  name: trimmed(140), type: z.enum(['ngo', 'charity', 'shelter', 'community_kitchen', 'other']).default('ngo'),
  registrationNumber: z.string().trim().max(60).optional(), description: z.string().max(800).optional(),
  address: z.string().max(250).optional(), contactPhone: z.string().max(30).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional(),
}).strict();

export const donationBase = z.object({
  title: trimmed(120, 3), category: trimmed(40), description: z.string().trim().max(1000).optional(),
  quantity: z.coerce.number().positive().max(100000), unit: z.enum(UNITS), servings: z.coerce.number().min(0).max(100000).optional(),
  dietary: z.enum(['vegetarian', 'non_vegetarian', 'vegan', 'not_applicable']).default('not_applicable'),
  allergens: z.array(z.string().trim().max(40)).max(14).default([]),
  preparedAt: z.coerce.date().optional(), storage: z.enum(['ambient', 'refrigerated', 'frozen', 'hot_held']).default('ambient'),
  address: trimmed(250, 5), city: z.string().trim().max(80).optional(), lat: point.shape.lat, lng: point.shape.lng,
  pickupInstructions: z.string().max(500).optional(), handlingNotes: z.string().max(500).optional(),
  availableFrom: z.coerce.date(), pickupDeadline: z.coerce.date(), requireVerifiedOrg: z.boolean().optional(),
  safetyDeclaration: z.boolean(), saveAsDraft: z.boolean().default(false),
}).strict();
export const donationUpdateSchema = donationBase.partial().strict();

export const requestCreateSchema = z.object({ donation: objectId, quantity: z.coerce.number().positive(), message: z.string().trim().max(500).optional(), needsVolunteer: z.boolean().default(false) }).strict();
export const reasonSchema = z.object({ reason: z.string().trim().max(300).optional() }).strict();
export const handoverVerifySchema = z.object({ token: z.string().min(10).max(200) }).strict();
export const assignSchema = z.object({ volunteer: objectId }).strict();

export const recurringSchema = z.object({
  title: trimmed(120, 3), category: trimmed(40), description: z.string().max(1000).optional(),
  quantity: z.coerce.number().positive(), unit: z.enum(UNITS), servings: z.coerce.number().min(0).optional(),
  dietary: z.enum(['vegetarian', 'non_vegetarian', 'vegan', 'not_applicable']).default('not_applicable'),
  storage: z.enum(['ambient', 'refrigerated', 'frozen', 'hot_held']).default('ambient'), allergens: z.array(z.string().max(40)).max(14).default([]),
  address: trimmed(250, 5), city: z.string().max(80).optional(), lat: point.shape.lat, lng: point.shape.lng, pickupInstructions: z.string().max(500).optional(),
  frequency: z.enum(['daily', 'weekly']), daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  startDate: ymd, endDate: ymd.optional(), windowStart: hhmm, windowEnd: hhmm,
  timezone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
}).strict().superRefine((v, ctx) => {
  if (v.windowEnd <= v.windowStart) ctx.addIssue({ code: 'custom', path: ['windowEnd'], message: 'End time must be after start time' });
  if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after the start date' });
  if (v.frequency === 'weekly' && v.daysOfWeek.length === 0) ctx.addIssue({ code: 'custom', path: ['daysOfWeek'], message: 'Pick at least one day' });
});

export const reportSchema = z.object({ donation: objectId, reason: z.enum(['incorrect_information', 'unsafe_handling', 'expired_food', 'suspicious_listing', 'inappropriate_content', 'other']), details: z.string().trim().max(800).optional() }).strict();
export const categorySchema = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,40}$/), name: trimmed(60), description: z.string().max(200).optional(), requiresPrepTime: z.boolean().default(false), active: z.boolean().default(true) }).strict();
export const settingsSchema = z.object({
  requireVerifiedOrgDefault: z.boolean().optional(), requestExpiryHours: z.number().min(1).max(168).optional(), maxActiveAssignmentsPerVolunteer: z.number().int().min(1).max(20).optional(),
  cookedMealMaxHoursSincePrep: z.number().min(0.5).max(48).optional(), minPickupWindowMinutes: z.number().min(5).max(720).optional(), maxPickupWindowHours: z.number().min(1).max(168).optional(),
}).strict();
export const idParam = z.object({ id: objectId });
export { objectId };
