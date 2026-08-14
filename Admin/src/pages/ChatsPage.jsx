import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Eye } from 'lucide-react'
import { motion } from 'framer-motion'
import { getAllConversations, getPartnerConversations } from '@/api/chat.api'
import Card from '@/components/ui/Card'
import SearchBar from '@/components/ui/SearchBar'
import FilterDropdown from '@/components/ui/FilterDropdown'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import { formatDateTime } from '@/utils/formatters'

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Closed', value: 'closed' },
]

const ChatsPage = () => {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const partnerFilter  = searchParams.get('partner') // pre-filter by partner if coming from PartnerDetailPage

  const [page,   setPage]   = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(undefined)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-conversations', page, status, partnerFilter],
    queryFn: () =>
      partnerFilter
        ? getPartnerConversations(partnerFilter, { page, limit: 20, status })
        : getAllConversations({ page, limit: 20, status }),
    keepPreviousData: true,
  })

  const handleSearch = useCallback((v) => {
    setSearch(v)
    setPage(1)
  }, [])

  const handleClearFilters = () => {
    setSearch('')
    setStatus(undefined)
    setPage(1)
  }

  const hasFilters = search || status

  const conversations = data?.conversations || []
  const pagination    = data?.pagination

  // Client-side search filter (partner / customer name)
  const filtered = search
    ? conversations.filter((c) => {
        const partnerName  = c.partner?.fullName?.toLowerCase()  || ''
        const customerName = (c.customer?.name || c.customer?.fullName || '').toLowerCase()
        const q = search.toLowerCase()
        return partnerName.includes(q) || customerName.includes(q)
      })
    : conversations

  return (
    <div className="space-y-5">
      <PageHeader
        title="Chats"
        subtitle={
          pagination
            ? `${pagination.total} conversation${pagination.total !== 1 ? 's' : ''} on the platform`
            : 'Monitor all partner–customer conversations'
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder="Search by partner or customer name…"
            className="w-full sm:w-72"
          />
          <FilterDropdown
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={STATUS_OPTIONS}
            placeholder="Status"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Conversations table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Partner', 'Customer', 'Last Message', 'Sent At', 'Status', 'Actions'].map((col) => (
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
                Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton.TableRow key={i} cols={6} />
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6}>
                    <ErrorState message="Could not load conversations." onRetry={refetch} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState.NoResults onClear={hasFilters ? handleClearFilters : undefined} />
                  </td>
                </tr>
              ) : (
                filtered.map((conv, i) => {
                  const customerName = conv.customer?.name || conv.customer?.fullName || 'Unknown'
                  const partnerName  = conv.partner?.fullName || 'Unknown'

                  return (
                    <motion.tr
                      key={conv._id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      {/* Partner */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={conv.partner?.profilePhoto} name={partnerName} size="sm" />
                          <span className="font-medium text-slate-800 truncate max-w-[140px]">
                            {partnerName}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={conv.customer?.profilePhoto} name={customerName} size="sm" />
                          <span className="font-medium text-slate-700 truncate max-w-[140px]">
                            {customerName}
                          </span>
                        </div>
                      </td>

                      {/* Last message */}
                      <td className="px-4 py-3.5 max-w-[220px]">
                        {conv.lastMessage?.text ? (
                          <p className="text-slate-600 truncate text-xs leading-relaxed">
                            <span className="font-medium text-slate-500 capitalize">
                              {conv.lastMessage.senderType}:
                            </span>{' '}
                            {conv.lastMessage.text}
                          </p>
                        ) : (
                          <span className="text-slate-400 text-xs">No messages yet</span>
                        )}
                      </td>

                      {/* Sent at */}
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {conv.lastMessage?.sentAt ? formatDateTime(conv.lastMessage.sentAt) : '—'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge
                          label={conv.status === 'closed' ? 'Closed' : 'Active'}
                          variant={conv.status === 'closed' ? 'default' : 'success'}
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => navigate(`/chats/${conv._id}`)}
                          aria-label={`View conversation between ${partnerName} and ${customerName}`}
                        >
                          View
                        </Button>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={20}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

export default ChatsPage
