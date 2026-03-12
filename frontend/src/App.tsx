import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import LoginPage from '@/pages/LoginPage'
import TablesPage from '@/pages/TablesPage'
import ServicePage from '@/pages/ServicePage'
import KitchenPage from '@/pages/KitchenPage'
import HistoryPage from '@/pages/HistoryPage'
import SettingsPage from '@/pages/SettingsPage'
import DashboardPage from '@/pages/DashboardPage'
import PaymentSuccessPage from '@/pages/PaymentSuccessPage'
import PaymentCancelledPage from '@/pages/PaymentCancelledPage'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppLayout from '@/components/AppLayout'

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Public pages — shown on customer's phone after Stripe redirect */}
        <Route path="/payment-success" element={<PaymentSuccessPage />} />
        <Route path="/payment-cancelled" element={<PaymentCancelledPage />} />

        {/* All authenticated routes share AppLayout (header + bottom nav) */}
        <Route element={<ProtectedRoute allowedRoles={['waiter', 'kitchen', 'manager']} />}>
          <Route element={<AppLayout />}>
            {/* All roles */}
            <Route path="/kitchen" element={<KitchenPage />} />

            {/* Waiter + Manager */}
            <Route element={<ProtectedRoute allowedRoles={['waiter', 'manager']} />}>
              <Route path="/tables" element={<TablesPage />} />
              <Route path="/service/:tableId" element={<ServicePage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Route>

            {/* Manager only */}
            <Route element={<ProtectedRoute allowedRoles={['manager']} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
