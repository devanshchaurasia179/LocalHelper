import { Construction } from 'lucide-react'

/**
 * PlaceholderPage — used for sidebar items not yet implemented.
 * Prevents 404s while keeping navigation functional.
 */
const PlaceholderPage = ({ title = 'Coming Soon' }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
    <div className="p-5 rounded-2xl bg-slate-100 mb-5">
      <Construction className="w-10 h-10 text-slate-400" aria-hidden="true" />
    </div>
    <h1 className="text-lg font-bold text-slate-700 mb-2">{title}</h1>
    <p className="text-sm text-slate-400 max-w-xs">
      This module is under development and will be available in a future update.
    </p>
  </div>
)

export default PlaceholderPage
