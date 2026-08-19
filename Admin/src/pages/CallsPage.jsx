import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Phone, Play } from 'lucide-react'
import { getAllCalls } from '@/api/call.api'
import Card from '@/components/ui/Card'
import SearchBar from '@/components/ui/SearchBar'
import FilterDropdown from '@/components/ui/FilterDropdown'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import RecordingPlayerModal from '@/components/calls/RecordingPlayerModal'
import { formatDateTime } from '@/utils/formatters'

// ── Filter options ────────────────────────────────────────────────────────────

const CALL_STATUS_OPTIONS = [
  { label: 'Ringing',    value: 'ringing' },
  { label: 'Accepted',   value: 'accepted' },
  { label: 'Ongoing',    value: 'ongoing' },
  { label: 'Completed',  value: 'completed' },
  { label: 'Rejected',   value: 'rejected' },
  { label: 'Missed',     value: 'missed' },
  { label: 'Cancelled',  value: 'cancelled' },
  { label: 'Failed',     value: 'failed' },
]

const RECORDING_STATUS_OPTIONS = [
  { label: 'Not Started',  value: 'not_started' },
  { label: 'Starting',     value: 'starting' },
  { label: 'Recording',    value: 'recording' },
  { label: 'Processing',   value: 'processing' },
  { label: 'Completed',    value: 'completed' },
  { label: 'Failed',       value: 'failed' },
]

const SORT_OPTIONS = [
  { label: 'Newest first', value: 'createdAt_desc' },
  { label: 'Oldest first', value: 'createdAt_asc' },
  { label: 'Longest',      value: 'duration_desc' },
  { label: 'Shortest',     value: 'duration_asc' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const getCallStatusVariant = (status) => {
  const map = {
    ringing:   'info',
    accepted:  'info',
    ongoing:   'info',
    completed: 'success',
    rejected:  'warning',
    missed:    'warning',
    cancelled: 'default',
    failed:    'danger',
  }
  return map[status] || 'default'
}

const getRecordingStatusVariant = (status) => {
  const map = {
    not_started: 'default',
    starting:    'info',
    recording:   'info',
    processing:  'warning',
    completed:   'success',
    failed:      'danger',
  }
  return map[status] || 'default'
}

const getRecordingStatusLabel = (status) => {
  const map = {
    not_started: 'No recording',
    starting:    'Starting...',
    recording:   'Recording',
    processing:  'Processing...',
    completed:   'Available',
    failed:      'Failed',
  }
  return map[status] || status || 'No recording'
}

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '—'
  if (seconds === 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// ── Main Component ────────────────────────────────────────────────────────────

const CallsPage = () => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(undefined)
  const [recordingStatus, setRecordingStatus] = useState(undefined)
  const [sort, setSort] = useState('createdAt_desc')

  // Recording player
  const [playerOpen, setPlayerOpen] = useState(false)
  const [selectedCall, setSelectedCall] = useState(null)

  const [sortBy, sortOrder] = sort.split('_')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-calls', page, search, status, recordingStatus, sortBy, sortOrder],
    queryFn: () =>
      getAllCalls({ page, limit: 15, search, status, recordingStatus, sortBy, sortOrder }),
    keepPreviousData: true,
  })

  const handleSearch = useCallback((v) => {
    setSearch(v)
    setPage(1)
  }, [])

  const handleClearFilters = () => {
    setSearch('')
    setStatus(undefined)
    setRecordingStatus(undefined)
    setSort('createdAt_desc')
    setPage(1)
  }

  const handleListen = (call) => {
    setSelectedCall(call)
    setPlayerOpen(true)
  }

  const handleClosePlayer = () => {
    setPlayerOpen(false)
    setSelectedCall(null)
  }

  const hasFilters = search || status || recordingStatus
  const calls = data?.calls || []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Calls"
        subtitle={pagination ? `${pagination.total} calls recorded` : 'Monitor all customer-partner calls'}
      />

      <Card>
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder="Search by name or phone..."
            className="w-full sm:w-64"
          />
          <FilterDropdown
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={CALL_STATUS_OPTIONS}
            placeholder="Call status"
          />
          <FilterDropdown
            value={recordingStatus}
            onChange={(v) => { setRecordingStatus(v); setPage(1) }}
            options={RECORDING_STATUS_OPTIONS}
            placeholder="Recording"
          />
          <FilterDropdown
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            placeholder="Sort"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Calls table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Customer', 'Partner', 'Date', 'Duration', 'Call Status', 'Recording', 'Actions'].map(
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
                Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton.TableRow key={i} cols={7} />
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7}>
                    <ErrorState
                      message="Could not load calls."
                      onRetry={refetch}
                    />
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Phone}
                      title="No calls found"
                      description="No calls match the current filters."
                      action={hasFilters ? { label: 'Clear filters', onClick: handleClearFilters } : undefined}
                    />
                  </td>
                </tr>
              ) : (
                calls.map((call, i) => (
                  <motion.tr
                    key={call._id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    {/* Customer */}
                    <td className="px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate max-w-[140px]">
                          {call.customer?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-400">{call.customer?.phone || ''}</p>
                      </div>
                    </td>
                    {/* Partner */}
                    <td className="px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate max-w-[140px]">
                          {call.partner?.fullName || '—'}
                        </p>
                        <p className="text-xs text-slate-400">{call.partner?.phone || ''}</p>
                      </div>
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                      {formatDateTime(call.startedAt || call.createdAt)}
                    </td>
                    {/* Duration */}
                    <td className="px-4 py-3.5 text-slate-700 font-medium tabular-nums whitespace-nowrap">
                      {formatDuration(call.duration)}
                    </td>
                    {/* Call Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={call.status}
                        variant={getCallStatusVariant(call.status)}
                      />
                    </td>
                    {/* Recording Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={getRecordingStatusLabel(call.recording?.status)}
                        variant={getRecordingStatusVariant(call.recording?.status)}
                      />
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      {call.recording?.status === 'completed' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Play className="w-3.5 h-3.5" />}
                          onClick={() => handleListen(call)}
                          aria-label={`Listen to recording of call with ${call.customer?.name || 'customer'}`}
                        >
                          Listen
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </motion.tr>
                ))
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
              limit={pagination.limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Recording player modal */}
      <RecordingPlayerModal
        isOpen={playerOpen}
        onClose={handleClosePlayer}
        call={selectedCall}
      />
    </div>
  )
}

export default CallsPage
