import mongoose from 'mongoose';
const schema = new mongoose.Schema({ key: { type: String, unique: true, required: true }, value: mongoose.Schema.Types.Mixed }, { timestamps: true });
const Setting = mongoose.model('Setting', schema);
export default Setting;

export const SETTING_DEFAULTS = {
  requireVerifiedOrgDefault: true,
  requestExpiryHours: 12,
  maxActiveAssignmentsPerVolunteer: 3,
  cookedMealMaxHoursSincePrep: 4,
  minPickupWindowMinutes: 30,
  maxPickupWindowHours: 48,
};
export async function getSettings() {
  const rows = await Setting.find().lean();
  return { ...SETTING_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}
