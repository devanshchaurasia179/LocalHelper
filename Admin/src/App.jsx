import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import DashboardLayout from '@/components/layout/DashboardLayout'

// Pages
import LoginPage                from '@/pages/LoginPage'
import DashboardPage            from '@/pages/DashboardPage'
import PartnersPage             from '@/pages/PartnersPage'
import PartnerDetailPage        from '@/pages/PartnerDetailPage'
import DocumentManagementPage   from '@/pages/DocumentManagementPage'
import ServicesPage             from '@/pages/ServicesPage'
import TransactionsPage         from '@/pages/TransactionsPage'
import ChatsPage                from '@/pages/ChatsPage'
import ChatDetailPage           from '@/pages/ChatDetailPage'
import PlaceholderPage          from '@/pages/PlaceholderPage'
import NotFoundPage             from '@/pages/NotFoundPage'

/**
 * Redirects /verification/:partnerId → /partners/:partnerId
 */
const RedirectToPartner = () => {
  const { partnerId } = useParams()
  return <Navigate to={`/partners/${partnerId}`} replace />
}

/**
 * App — root component.
 *
 * Routing structure:
 *   /login                           → LoginPage (public)
 *   /                                → redirect to /dashboard
 *   /dashboard                       → DashboardPage           (protected)
 *   /partners                        → PartnersPage            (protected)
 *   /partners/:id                    → PartnerDetailPage       (protected) — full detail + doc review
 *   /verification                    → redirects to /partners
 *   /verification/:partnerId         → redirects to /partners/:partnerId
 *   /documents                       → DocumentManagementPage  (protected) — document type CRUD
 *   /customers, /bookings...         → PlaceholderPage         (protected)
 *   *                                → 404
 *
 * AuthProvider wraps the entire tree so any component can call useAuth().
 * BrowserRouter must wrap AuthProvider since AuthContext uses useNavigate
 * (indirectly through the logout handler).
 */
const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Protected — DashboardLayout wraps all dashboard pages */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard"                element={<DashboardPage />} />
            <Route path="/partners"                 element={<PartnersPage />} />
            <Route path="/partners/:id"             element={<PartnerDetailPage />} />
            <Route path="/verification"             element={<Navigate to="/partners" replace />} />
            <Route path="/verification/:partnerId"  element={<RedirectToPartner />} />
            <Route path="/documents"                element={<DocumentManagementPage />} />
            <Route path="/customers"    element={<PlaceholderPage title="Customers" />} />
            <Route path="/bookings"     element={<PlaceholderPage title="Bookings" />} />
            <Route path="/services"     element={<ServicesPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/chats"        element={<ChatsPage />} />
            <Route path="/chats/:conversationId" element={<ChatDetailPage />} />
            <Route path="/payments"     element={<PlaceholderPage title="Payments" />} />
            <Route path="/analytics"    element={<PlaceholderPage title="Analytics" />} />
            <Route path="/settings"     element={<PlaceholderPage title="Settings" />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
)

export default App
