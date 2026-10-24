import { Link, Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import Home from './pages/public/Home.jsx';
import Browse from './pages/public/Browse.jsx';
import DonationDetails from './pages/public/DonationDetails.jsx';
import { About, Contact, FAQPage, FoodSafety, HowItWorks, Privacy, Terms } from './pages/public/StaticPages.jsx';
import { ForgotPassword, Login, Register, ResetPassword, VerifyEmail } from './pages/auth/AuthPages.jsx';
import { CreateDonation, DonorAnalytics, DonorDashboard, DonorHistory, DonorRequests, EditDonation, MyDonations, Recurring } from './pages/donor/DonorPages.jsx';
import { NgoAnalytics, NgoBrowse, NgoDashboard, NgoRequestDetails, NgoRequests, Organization } from './pages/ngo/NgoPages.jsx';
import { AvailablePickups, MyPickups, PickupDetails, ScanPage, VolunteerDashboard } from './pages/volunteer/VolunteerPages.jsx';
import { AdminAuditLogs, AdminCategories, AdminDonations, AdminOrganizations, AdminOverview, AdminPickups, AdminReports, AdminRequests, AdminSettings, AdminUsers } from './pages/admin/AdminPages.jsx';
import { NotificationsPage, PartyPickups, ProfilePage } from './pages/shared/SharedPages.jsx';

const NotFound = () => <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}><h1>Page not found</h1><p className="muted">The page you’re looking for doesn’t exist.</p><Link className="btn btn-primary" to="/">Back to home</Link></div>;

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="browse" element={<Browse />} />
        <Route path="donations/:id" element={<DonationDetails />} />
        <Route path="about" element={<About />} /><Route path="how-it-works" element={<HowItWorks />} /><Route path="contact" element={<Contact />} />
        <Route path="faq" element={<FAQPage />} /><Route path="food-safety" element={<FoodSafety />} /><Route path="privacy" element={<Privacy />} /><Route path="terms" element={<Terms />} />
        <Route path="login" element={<Login />} /><Route path="register" element={<Register />} /><Route path="verify-email" element={<VerifyEmail />} />
        <Route path="forgot-password" element={<ForgotPassword />} /><Route path="reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}><Route path="notifications" element={<NotificationsPage />} /></Route></Route>

      <Route element={<ProtectedRoute roles={['donor']} />}><Route path="donor" element={<DashboardLayout />}>
        <Route index element={<DonorDashboard />} /><Route path="donations" element={<MyDonations />} /><Route path="donations/new" element={<CreateDonation />} /><Route path="donations/:id/edit" element={<EditDonation />} />
        <Route path="requests" element={<DonorRequests />} /><Route path="pickups" element={<PartyPickups />} /><Route path="recurring" element={<Recurring />} /><Route path="history" element={<DonorHistory />} />
        <Route path="analytics" element={<DonorAnalytics />} /><Route path="profile" element={<ProfilePage />} />
      </Route></Route>

      <Route element={<ProtectedRoute roles={['ngo']} />}><Route path="ngo" element={<DashboardLayout />}>
        <Route index element={<NgoDashboard />} /><Route path="browse" element={<NgoBrowse />} /><Route path="requests" element={<NgoRequests />} /><Route path="requests/:id" element={<NgoRequestDetails />} />
        <Route path="pickups" element={<PartyPickups />} /><Route path="history" element={<NgoRequests history />} /><Route path="analytics" element={<NgoAnalytics />} /><Route path="organization" element={<Organization />} /><Route path="profile" element={<ProfilePage />} />
      </Route></Route>

      <Route element={<ProtectedRoute roles={['volunteer']} />}><Route path="volunteer" element={<DashboardLayout />}>
        <Route index element={<VolunteerDashboard />} /><Route path="available" element={<AvailablePickups />} /><Route path="pickups" element={<MyPickups />} /><Route path="pickups/:id" element={<PickupDetails />} />
        <Route path="scan" element={<ScanPage />} /><Route path="completed" element={<MyPickups completed />} /><Route path="profile" element={<ProfilePage />} />
      </Route></Route>

      <Route element={<ProtectedRoute roles={['admin']} />}><Route path="admin" element={<DashboardLayout />}>
        <Route index element={<AdminOverview />} /><Route path="users" element={<AdminUsers />} /><Route path="organizations" element={<AdminOrganizations />} /><Route path="donations" element={<AdminDonations />} />
        <Route path="requests" element={<AdminRequests />} /><Route path="pickups" element={<AdminPickups />} /><Route path="reports" element={<AdminReports />} /><Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="categories" element={<AdminCategories />} /><Route path="settings" element={<AdminSettings />} />
      </Route></Route>
      <Route path="/dashboard" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
