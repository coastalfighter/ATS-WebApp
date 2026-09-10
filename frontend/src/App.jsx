import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FreshCandidatesPage from './pages/FreshCandidatesPage';
import PipelineCandidatesPage from './pages/PipelineCandidatesPage';
import AllCandidatesPage from './pages/AllCandidatesPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import UploadCandidatesPage from './pages/UploadCandidatesPage';
import BatchHistoryPage from './pages/BatchHistoryPage';
import InterviewsPage from './pages/InterviewsPage';
import ReportsPage from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';
import DuplicateReviewPage from './pages/DuplicateReviewPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import CalendarPage from './pages/CalendarPage';
import AuditLogPage from './pages/AuditLogPage';
import EmailLogsPage from './pages/EmailLogsPage';
import ProfilePage from './pages/ProfilePage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ZoomRoomsPage from './pages/ZoomRoomsPage';
import HeatMapPage from './pages/HeatMapPage';
import CallLogsPage from './pages/CallLogsPage';
import ManageSlotsPage from './pages/ManageSlotsPage';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/candidates/fresh" element={<FreshCandidatesPage />} />
        <Route path="/candidates/pipeline" element={<PipelineCandidatesPage />} />
        <Route path="/candidates/all" element={<AllCandidatesPage />} />
        <Route path="/candidates/upload" element={<UploadCandidatesPage />} />
        <Route path="/candidates/batches" element={<BatchHistoryPage />} />
        <Route path="/candidates/duplicates" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><DuplicateReviewPage /></ProtectedRoute>
        } />
        <Route path="/candidates/:id" element={<CandidateDetailPage />} />
        <Route path="/interviews" element={<InterviewsPage />} />
        <Route path="/interview-slots" element={<ManageSlotsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/heatmap" element={<HeatMapPage />} />
        <Route path="/call-logs" element={<CallLogsPage />} />
        <Route path="/zoom-rooms" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><ZoomRoomsPage /></ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><ReportsPage /></ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><UserManagementPage /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><AdminSettingsPage /></ProtectedRoute>
        } />
        <Route path="/audit" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><AuditLogPage /></ProtectedRoute>
        } />
        <Route path="/email-logs" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><EmailLogsPage /></ProtectedRoute>
        } />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
