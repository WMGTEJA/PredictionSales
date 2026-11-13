import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SalesDataProvider } from './hooks/useSalesData';
import Layout from './components/Layout';
import SalesOrderDashboard from './pages/SalesOrderDashboard';
import SalesOrderPrediction from './pages/SalesOrderPrediction';
import SalesInvoiceDashboard from './pages/SalesInvoiceDashboard';
import SalesInvoicePrediction from './pages/SalesInvoicePrediction';
import FulfillmentDashboard from './pages/FulfillmentDashboard';
import { redirectToMainApp, resolveInitialSsoSession } from './lib/sso';

export default function App() {
  const [ssoUser] = useState(() => resolveInitialSsoSession());

  useEffect(() => {
    if (!ssoUser) {
      redirectToMainApp(true);
    }
  }, [ssoUser]);

  if (!ssoUser) {
    return null;
  }

  return (
    <SalesDataProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/so/dashboard" replace />} />
          <Route path="/so" element={<Navigate to="/so/dashboard" replace />} />
          <Route path="/so/dashboard" element={<SalesOrderDashboard />} />
          <Route path="/so/prediction" element={<SalesOrderPrediction />} />

          <Route path="/si" element={<Navigate to="/si/dashboard" replace />} />
          <Route path="/si/dashboard" element={<SalesInvoiceDashboard />} />
          <Route path="/si/prediction" element={<SalesInvoicePrediction />} />

          <Route path="/fulfillment" element={<FulfillmentDashboard />} />
          <Route path="*" element={<Navigate to="/so/dashboard" replace />} />
        </Routes>
      </Layout>
    </SalesDataProvider>
  );
}
