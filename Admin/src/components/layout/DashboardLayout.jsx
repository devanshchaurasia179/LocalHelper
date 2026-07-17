import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

/**
 * DashboardLayout — shell that wraps all authenticated pages.
 *
 * Structure:
 *   <div flex-row>
 *     <Sidebar />          — fixed-width left panel
 *     <div flex-col>
 *       <Navbar />         — sticky top bar
 *       <main>
 *         <Outlet />       — page content
 *       </main>
 *     </div>
 *   </div>
 *
 * State lives here so Navbar can open/close the mobile sidebar.
 */
const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed((p) => !p)}
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />

        <main
          className="flex-1 overflow-y-auto p-4 md:p-6"
          id="main-content"
          aria-label="Main content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
