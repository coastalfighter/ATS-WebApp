import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FreshCandidatesPage from './pages/FreshCandidatesPage';
import PipelineCandidatesPage from './pages/PipelineCandidatesPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import UploadCandidatesPage from './pages/UploadCandidatesPage';
import BatchHistoryPage from './pages/BatchHistoryPage';
import InterviewsPage from './pages/InterviewsPage';
import ReportsPage from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';
import DuplicateReviewPage from './pages/DuplicateReviewPage';
import ProfilePage from './pages/ProfilePage';
import ChangePasswordPage from './pages/ChangePasswordPage';

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
        <Route path="/candidates/upload" element={<UploadCandidatesPage />} />
        <Route path="/candidates/batches" element={<BatchHistoryPage />} />
        <Route path="/candidates/duplicates" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><DuplicateReviewPage /></ProtectedRoute>
        } />
        <Route path="/candidates/:id" element={<CandidateDetailPage />} />
        <Route path="/interviews" element={<InterviewsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users" element={
          <ProtectedRoute roles={['admin', 'subadmin']}><UserManagementPage /></ProtectedRoute>
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
