import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Eye, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { getPendingPartners } from '@/api/partner.api'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Pagination from '@/components/ui/Pagination'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import { formatDate } from '@/utils/formatters'

const VerificationPage = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pendingPartners', page],
    queryFn:  () => getPendingPartners({ page, limit: 10 }),
    keepPreviousData: true,
  })

  const partners   = data?.partners || []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Partner Verification"
        subtitle="Review partners who have submitted documents and are awaiting verification."
      />

      {/* Stat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Awaiting Review"
          value={isLoading ? '—' : (pagination?.total ?? 0)}
          icon={Clock}
          iconColor="bg-amber-50"
          iconTextColor="text-amber-600"
          loading={isLoading}
        />
      </div>

      {/* Partners list */}
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-800">
            Pending Verifications
            {pagination && (
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({pagination.total} total)
              </span>
            )}
          </h2>
        </Card.Header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Pending verifications table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Partner', 'Phone', 'City', 'Services', 'Documents', 'Submitted', 'Actions'].map(
                  (col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col}
                    </th>
                  )
                )}
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
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={ShieldCheck}
                      title="All caught up!"
                      description="There are no partners waiting for verification review right now."
                    />
                  </td>
                </tr>
              ) : (
                partners.map((partner, i) => (
                  <motion.tr
                    key={partner._id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar src={partner.profilePhoto} name={partner.fullName} size="sm" />
                        <span className="font-medium text-slate-800 truncate max-w-[140px]">
                          {partner.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {partner.phone}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {partner.address?.city || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      {partner.categories?.length > 0 ? (
                        <span className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">
                          {partner.categories[0].name}
                          {partner.categories.length > 1 && ` +${partner.categories.length - 1}`}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* Document completion indicators */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <DocDot filled={partner.isProfile} label="Profile" />
                        <DocDot filled={partner.isService} label="Service" />
                        <DocDot filled={partner.isDocument} label="Documents" />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {formatDate(partner.createdAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => navigate(`/partners/${partner._id}`)}
                        aria-label={`Review ${partner.fullName}`}
                      >
                        Review
                      </Button>
                    </td>
                  </motion.tr>
                ))
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

// Small dot indicator for onboarding step completion
const DocDot = ({ filled, label }) => (
  <div
    className={`w-2.5 h-2.5 rounded-full transition-colors ${filled ? 'bg-emerald-500' : 'bg-slate-200'}`}
    title={`${label}: ${filled ? 'Complete' : 'Incomplete'}`}
    aria-label={`${label} ${filled ? 'complete' : 'incomplete'}`}
  />
)

export default VerificationPage
