import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SalesDataProvider } from './hooks/useSalesData';
import Layout from './components/Layout';
import { redirectToMainApp, resolveInitialSsoSession } from './lib/sso';

const SalesOrderDashboard = lazy(() => import('./pages/SalesOrderDashboard'));
const SalesOrderPrediction = lazy(() => import('./pages/SalesOrderPrediction'));
const SalesInvoiceDashboard = lazy(() => import('./pages/SalesInvoiceDashboard'));
const SalesInvoicePrediction = lazy(() => import('./pages/SalesInvoicePrediction'));
const FulfillmentDashboard = lazy(() => import('./pages/FulfillmentDashboard'));

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-2.5 rounded-full border border-[#c79754]/30 bg-[#37150f] px-4 py-2 text-xs font-bold text-[#f5d275] shadow-sm">
        <span className="size-2.5 animate-pulse rounded-full bg-[#f5d275]" />
        <span>Loading view…</span>
      </div>
    </div>
  );
}

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
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </Layout>
    </SalesDataProvider>
  );
}
