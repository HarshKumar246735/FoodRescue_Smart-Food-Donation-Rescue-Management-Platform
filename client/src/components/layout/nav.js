import { Bell, ClipboardList, HandHeart, Heart, History, LayoutDashboard, ListChecks, Map, PackagePlus, Repeat, Settings, ShieldCheck, Truck, UserCircle, Users, Flag, ScrollText, Tags, BarChart3, Search, Building2, QrCode, Inbox } from 'lucide-react';

export const NAV = {
  donor: [
    ['/donor', 'Dashboard', LayoutDashboard, true], ['/donor/donations/new', 'New donation', PackagePlus], ['/donor/donations', 'My donations', ClipboardList],
    ['/donor/requests', 'Requests', Inbox], ['/donor/pickups', 'Pickups', Truck], ['/donor/recurring', 'Recurring', Repeat], ['/donor/history', 'History', History],
    ['/donor/analytics', 'Impact', BarChart3], ['/notifications', 'Notifications', Bell], ['/donor/profile', 'Profile', UserCircle],
  ],
  ngo: [
    ['/ngo', 'Dashboard', LayoutDashboard, true], ['/ngo/browse', 'Find food', Search], ['/ngo/requests', 'My requests', ClipboardList], ['/ngo/pickups', 'Pickup coordination', Truck],
    ['/ngo/history', 'History', History], ['/ngo/analytics', 'Impact', BarChart3], ['/notifications', 'Notifications', Bell], ['/ngo/organization', 'Organization', Building2],
  ],
  volunteer: [
    ['/volunteer', 'Dashboard', LayoutDashboard, true], ['/volunteer/available', 'Available pickups', Search], ['/volunteer/pickups', 'My pickups', Truck], ['/volunteer/scan', 'QR verification', QrCode],
    ['/volunteer/completed', 'Completed', ListChecks], ['/notifications', 'Notifications', Bell], ['/volunteer/profile', 'Profile', UserCircle],
  ],
  admin: [
    ['/admin', 'Overview', LayoutDashboard, true], ['/admin/users', 'Users', Users], ['/admin/organizations', 'Verification', ShieldCheck], ['/admin/donations', 'Donations', ClipboardList],
    ['/admin/requests', 'Requests', Inbox], ['/admin/pickups', 'Pickups', Truck], ['/admin/reports', 'Reports', Flag], ['/admin/audit-logs', 'Audit logs', ScrollText],
    ['/admin/categories', 'Categories', Tags], ['/admin/settings', 'Settings', Settings], ['/notifications', 'Notifications', Bell],
  ],
};
export const homeFor = (role) => ({ donor: '/donor', ngo: '/ngo', volunteer: '/volunteer', admin: '/admin' }[role] || '/');
export const ROLE_LABEL = { donor: 'Donor', ngo: 'Organization', volunteer: 'Volunteer', admin: 'Administrator' };
