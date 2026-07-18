import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Eye, Clock, CalendarDays } from 'lucide-react'
import { motion } from 'framer-motion'
import { getPendingVerifications } from '@/api/verification.api'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Pagination from '@/components/ui/Pagination'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate, formatDateTime } from '@/utils/formatters'

/**
 * VerificationPage — paginated queue of partners awaiting verification review.
 *
 * Uses GET /api/admin/verification/pending which returns VerificationSession
 * records with a nested `partner` sub-object. This is the NEW system — each
 * row links to /verification/:partnerId which uses the dynamic document API.
 *
 * Response shape per item:
 *   { sessionId, sessionNumber, submittedAt, partner: { _id, fullName, phone,
 *     profilePhoto, address.city/state, verificationStatus } }
 */
const VerificationPage = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pendingVerifications', page],
    queryFn:  () => getPendingVerifications({ page, limit: 10 }),
    keepPreviousData: true,
  })

  const items      = data?.partners    || []  // each item: { sessionId, sessionNumber, submittedAt, partner }
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Partner Verification"
        subtitle="Review partners whose documents are awaiting verification. Oldest submissions are listed first."
      />

      {/* ── Stat card ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Awaiting Review"
          value={isLoading ? '—' : (pagination?.total ?? 0)}
          icon={Clock}
          iconColor="bg-amber-50"
          iconTextColor="text-amber-600"
          loading={isLoading}
        />
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Pending Verifications
              {pagination && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({pagination.total} total)
                </span>
              )}
            </h2>
            <span className="text-xs text-slate-400">Sorted: oldest first (FIFO queue)</span>
          </div>
        </Card.Header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Pending verifications table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Partner', 'Phone', 'City', 'Services', 'Session', 'Submitted', 'Actions'].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton.TableRow key={i} cols={7} />
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7}>
                    <ErrorState
                      message="Could not load pending verifications."
                      onRetry={refetch}
                    />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={ShieldCheck}
                      title="All caught up!"
                      description="No partners are currently waiting for verification review."
                    />
                  </td>
                </tr>
              ) : (
                items.map((item, i) => {
                  // item = { sessionId, sessionNumber, submittedAt, partner }
                  const p = item.partner
                  if (!p) return null

                  return (
                    <motion.tr
                      key={item.sessionId}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      {/* Partner */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar src={p.profilePhoto} name={p.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate max-w-[140px]">
                              {p.fullName}
                            </p>
                            <StatusBadge
                              label={p.verificationStatus || 'Under Review'}
                              variant="info"
                              size="sm"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {p.phone}
                      </td>

                      {/* City */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {p.address?.city || '—'}
                      </td>

                      {/* Categories */}
                      <td className="px-4 py-3.5">
                        {p.categories?.length > 0 ? (
                          <span className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">
                            {p.categories[0].name}
                            {p.categories.length > 1 && ` +${p.categories.length - 1}`}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Session number */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                          #{item.sessionNumber ?? 1}
                        </span>
                        {item.sessionNumber > 1 && (
                          <span className="ml-1.5 text-xs text-amber-600 font-medium">
                            Re-submitted
                          </span>
                        )}
                      </td>

                      {/* Submitted at */}
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                          {item.submittedAt
                            ? formatDate(item.submittedAt)
                            : formatDate(p.createdAt)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => navigate(`/verification/${p._id}`)}
                          aria-label={`Review ${p.fullName}`}
                        >
                          Review
                        </Button>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

export default VerificationPage
