import { Navigate, Route, Routes } from 'react-router-dom';
import { StorageProvider } from './hooks/useReports';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PredictionsPage from './pages/PredictionsPage';

export default function App() {
  return (
    <StorageProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/predictions" element={<PredictionsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </StorageProvider>
  );
}
