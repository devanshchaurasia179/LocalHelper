import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  RefreshCw,
  TrendingUp,
  Filter,
  BanknoteIcon,
  Clock,
  Eye,
} from 'lucide-react'
import { getPartnerTransactions, getPayoutQueue } from '@/api/transaction.api'
import { getAllPartners, getPartnerById } from '@/api/partner.api'
import useTransactionMutations from '@/hooks/useTransactionMutations'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import FilterDropdown from '@/components/ui/FilterDropdown'
import SearchBar from '@/components/ui/SearchBar'
import Pagination from '@/components/ui/Pagination'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { formatDateTime, formatCurrency } from '@/utils/formatters'
import { cn } from '@/utils/cn'
import ProcessPayoutModal from '@/components/transactions/ProcessPayoutModal'
import AdjustBalanceModal from '@/components/transactions/AdjustBalanceModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { label: 'Earning',    value: 'earning' },
  { label: 'Payout',     value: 'payout' },
  { label: 'Adjustment', value: 'adjustment' },
]

const STATUS_OPTIONS = [
  { label: 'Pending',    value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed',  value: 'completed' },
  { label: 'Failed',     value: 'failed' },
]

const getTypeVariant = (type) => {
  const map = { earning: 'success', payout: 'info', adjustment: 'warning' }
  return map[type] || 'default'
}

const getStatusVariant = (status) => {
  const map = { pending: 'warning', processing: 'info', completed: 'success', failed: 'danger' }
  return map[status] || 'default'
}

const DirectionIcon = ({ direction }) =>
  direction === 'credit' ? (
    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
  ) : (
    <ArrowUpRight className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
  )

// ── Payout Queue Section ──────────────────────────────────────────────────────

const PayoutQueueSection = ({ onProcess, onViewPartner }) => {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['payout-queue', page],
    queryFn: () => getPayoutQueue({ page, limit: 10 }),
    keepPreviousData: true,
  })

  const transactions = data?.transactions || []
  const pagination = data?.pagination

  if (isLoading) {
    return (
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Payout Requests</h3>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </Card.Body>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Payout Requests</h3>
          </div>
        </Card.Header>
        <Card.Body>
          <ErrorState message="Could not load payout queue." onRetry={refetch} />
        </Card.Body>
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Payout Requests</h3>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <BanknoteIcon className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-slate-600">No pending payouts</p>
            <p className="text-xs text-slate-400">All payout requests have been processed.</p>
          </div>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">
              Payout Requests
            </h3>
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pagination?.total || transactions.length}
            </span>
          </div>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={refetch}>
            Refresh
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        <div className="space-y-2">
          {transactions.map((tx, i) => (
            <motion.div
              key={tx._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all"
            >
              {/* Partner info */}
              <Avatar
                src={tx.partner?.profilePhoto}
                name={tx.partner?.fullName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {tx.partner?.fullName || 'Unknown Partner'}
                  </p>
                  <StatusBadge label={tx.status} variant={getStatusVariant(tx.status)} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-400">{tx.partner?.phone}</p>
                  <span className="text-slate-200">·</span>
                  <p className="text-xs text-slate-400">{formatDateTime(tx.createdAt)}</p>
                </div>
                {/* Payout method */}
                {tx.payoutDetails?.method === 'bank' && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bank ****{tx.payoutDetails.accountNumber}
                    {tx.payoutDetails.bankName && ` · ${tx.payoutDetails.bankName}`}
                  </p>
                )}
                {tx.payoutDetails?.method === 'upi' && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    UPI: {tx.payoutDetails.upiId}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-slate-800 tabular-nums">
                  {formatCurrency(tx.amount)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Eye className="w-3.5 h-3.5" />}
                  onClick={() => onViewPartner(tx.partner)}
                  title="View all transactions"
                >
                  View
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<RefreshCw className="w-3 h-3" />}
                  onClick={() => onProcess(tx)}
                >
                  Process
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={10}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

// ── Partner selector ──────────────────────────────────────────────────────────

const PartnerSelector = ({ value, onChange }) => {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['partners-selector', search],
    queryFn: () => getAllPartners({ search, limit: 30, page: 1 }),
    keepPreviousData: true,
  })

  const partners = data?.partners || []

  return (
    <div className="space-y-3">
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search partner by name or phone…"
        className="w-full"
      />
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : partners.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No partners found.</p>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {partners.map((p) => (
            <li key={p._id}>
              <button
                onClick={() => onChange(p)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                  value?._id === p._id
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-slate-50 border border-transparent'
                )}
              >
                <Avatar src={p.profilePhoto} name={p.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.fullName}</p>
                  <p className="text-xs text-slate-400">{p.phone}</p>
                </div>
                <div className="ml-auto text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-700">
                    {formatCurrency(p.walletBalance ?? 0)}
                  </p>
                  <p className="text-xs text-slate-400">wallet</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Transaction table ─────────────────────────────────────────────────────────

const TransactionTable = ({ partnerId, partnerName, onProcess, onAdjust }) => {
  const [page,   setPage]   = useState(1)
  const [type,   setType]   = useState(undefined)
  const [status, setStatus] = useState(undefined)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['transactions', partnerId, page, type, status],
    queryFn:  () => getPartnerTransactions(partnerId, { page, limit: 15, type, status }),
    enabled:  !!partnerId,
    keepPreviousData: true,
  })

  const transactions = data?.transactions || []
  const pagination   = data?.pagination

  const hasFilters = type || status

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={type}
            onChange={(v) => { setType(v); setPage(1) }}
            options={TYPE_OPTIONS}
            placeholder="Type"
          />
          <FilterDropdown
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={STATUS_OPTIONS}
            placeholder="Status"
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setType(undefined); setStatus(undefined); setPage(1) }}
            >
              Clear
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
          onClick={() => onAdjust(partnerId)}
        >
          Adjust Balance
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm" aria-label="Partner transactions table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['#', 'Date', 'Type', 'Direction', 'Amount', 'Balance After', 'Status', 'Description', 'Actions'].map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton.TableRow key={i} cols={9} />
              ))
            ) : isError ? (
              <tr>
                <td colSpan={9}>
                  <ErrorState message="Could not load transactions." onRetry={refetch} />
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState.NoResults
                    onClear={hasFilters ? () => { setType(undefined); setStatus(undefined) } : undefined}
                  />
                </td>
              </tr>
            ) : (
              transactions.map((tx, i) => (
                <motion.tr
                  key={tx._id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.025 }}
                >
                  {/* Row number */}
                  <td className="px-3 py-3 text-slate-400 text-xs tabular-nums">
                    {((page - 1) * 15) + i + 1}
                  </td>
                  {/* Date */}
                  <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {formatDateTime(tx.createdAt)}
                  </td>
                  {/* Type */}
                  <td className="px-3 py-3">
                    <StatusBadge label={tx.type} variant={getTypeVariant(tx.type)} />
                  </td>
                  {/* Direction */}
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1 text-xs font-medium capitalize">
                      <DirectionIcon direction={tx.direction} />
                      {tx.direction}
                    </span>
                  </td>
                  {/* Amount */}
                  <td className="px-3 py-3 font-semibold tabular-nums whitespace-nowrap">
                    <span className={tx.direction === 'credit' ? 'text-emerald-600' : 'text-red-500'}>
                      {tx.direction === 'credit' ? '+' : '−'}{formatCurrency(tx.amount)}
                    </span>
                  </td>
                  {/* Balance after */}
                  <td className="px-3 py-3 text-slate-600 font-medium tabular-nums whitespace-nowrap">
                    {formatCurrency(tx.balanceAfter)}
                  </td>
                  {/* Status */}
                  <td className="px-3 py-3">
                    <StatusBadge label={tx.status} variant={getStatusVariant(tx.status)} />
                  </td>
                  {/* Description */}
                  <td className="px-3 py-3 text-slate-500 text-xs max-w-[180px] truncate">
                    {tx.description || '—'}
                    {tx.failureReason && (
                      <span className="block text-red-400">{tx.failureReason}</span>
                    )}
                    {tx.payoutDetails?.method === 'bank' && (
                      <span className="block text-slate-400">
                        Bank ****{tx.payoutDetails.accountNumber}
                      </span>
                    )}
                    {tx.payoutDetails?.method === 'upi' && (
                      <span className="block text-slate-400">
                        UPI: {tx.payoutDetails.upiId}
                      </span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-3 py-3">
                    {tx.type === 'payout' && ['pending', 'processing'].includes(tx.status) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<RefreshCw className="w-3 h-3" />}
                        onClick={() => onProcess(tx)}
                      >
                        Process
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
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={15}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TransactionsPage = () => {
  const queryClient = useQueryClient()

  const [selectedPartner,    setSelectedPartner]    = useState(null)
  const [partnerModalOpen,   setPartnerModalOpen]   = useState(false)

  const [processModal,       setProcessModal]       = useState({ open: false, tx: null })
  const [adjustModal,        setAdjustModal]        = useState(false)

  // Live partner data — keeps wallet balance fresh after mutations
  const { data: partnerData } = useQuery({
    queryKey: ['partner', selectedPartner?._id],
    queryFn:  () => getPartnerById(selectedPartner._id),
    enabled:  !!selectedPartner?._id,
  })
  const livePartner = partnerData?.partner ?? selectedPartner

  const { processPayoutMutation, adjustBalanceMutation } = useTransactionMutations(
    selectedPartner?._id,
    {
      onProcessSuccess: () => {
        setProcessModal({ open: false, tx: null })
        // Also invalidate the payout queue
        queryClient.invalidateQueries({ queryKey: ['payout-queue'] })
      },
      onAdjustSuccess: () => setAdjustModal(false),
    }
  )

  const handleSelectPartner = useCallback((partner) => {
    setSelectedPartner(partner)
    setPartnerModalOpen(false)
  }, [])

  // Called from the payout queue "View" button
  const handleViewPartnerFromQueue = useCallback((partner) => {
    if (partner?._id) {
      setSelectedPartner(partner)
    }
  }, [])

  const handleProcessTx = useCallback((tx) => {
    // If processing from queue, make sure the partner is set for mutation context
    if (tx.partner?._id && (!selectedPartner || selectedPartner._id !== tx.partner._id)) {
      setSelectedPartner(tx.partner)
    }
    setProcessModal({ open: true, tx })
  }, [selectedPartner])

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Transactions"
        subtitle="Process payout requests, view partner ledgers, and adjust balances"
      />

      {/* ── Payout Queue ────────────────────────────────────────────── */}
      <PayoutQueueSection
        onProcess={handleProcessTx}
        onViewPartner={handleViewPartnerFromQueue}
      />

      {/* ── Partner selector card ────────────────────────────────────── */}
      <Card>
        <Card.Body>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {livePartner ? (
                <>
                  <Avatar
                    src={livePartner.profilePhoto}
                    name={livePartner.fullName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {livePartner.fullName}
                    </p>
                    <p className="text-xs text-slate-400">{livePartner.phone}</p>
                  </div>
                  {/* Live wallet summary chips */}
                  <div className="hidden sm:flex items-center gap-2 ml-4 flex-shrink-0">
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">
                      <Wallet className="w-3 h-3" />
                      {formatCurrency(livePartner.walletBalance ?? 0)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                      <TrendingUp className="w-3 h-3" />
                      {formatCurrency(livePartner.totalEarnings ?? 0)} lifetime
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Filter className="w-4 h-4" />
                  </div>
                  <p className="text-sm">Select a partner to view full transaction history</p>
                </div>
              )}
            </div>
            <Button
              variant={livePartner ? 'outline' : 'primary'}
              size="md"
              onClick={() => setPartnerModalOpen(true)}
            >
              {livePartner ? 'Change Partner' : 'Select Partner'}
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* ── Transactions table ─────────────────────────────────────── */}
      {selectedPartner ? (
        <Card>
          <Card.Header>
            <h3 className="text-sm font-semibold text-slate-800">
              Transaction History — {livePartner?.fullName}
            </h3>
          </Card.Header>
          <Card.Body>
            <TransactionTable
              partnerId={selectedPartner._id}
              partnerName={livePartner?.fullName}
              onProcess={handleProcessTx}
              onAdjust={() => setAdjustModal(true)}
            />
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <Card.Body>
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Wallet className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No partner selected</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Pick a partner above to see their full transaction ledger, process payouts, or make balance adjustments.
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-1"
                onClick={() => setPartnerModalOpen(true)}
              >
                Select Partner
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* ── Partner select modal ────────────────────────────────────── */}
      <Modal
        isOpen={partnerModalOpen}
        onClose={() => setPartnerModalOpen(false)}
        title="Select Partner"
        size="md"
      >
        <div className="px-6 py-5">
          <PartnerSelector
            value={selectedPartner}
            onChange={handleSelectPartner}
          />
        </div>
      </Modal>

      {/* ── Process payout modal ────────────────────────────────────── */}
      <ProcessPayoutModal
        isOpen={processModal.open}
        transaction={processModal.tx}
        onClose={() => setProcessModal({ open: false, tx: null })}
        onConfirm={({ status, failureReason }) =>
          processPayoutMutation.mutate({
            transactionId: processModal.tx?._id,
            status,
            failureReason,
          })
        }
        isLoading={processPayoutMutation.isPending}
      />

      {/* ── Adjust balance modal ────────────────────────────────────── */}
      <AdjustBalanceModal
        isOpen={adjustModal}
        partnerName={livePartner?.fullName}
        walletBalance={livePartner?.walletBalance}
        onClose={() => setAdjustModal(false)}
        onConfirm={(payload) =>
          adjustBalanceMutation.mutate(payload)
        }
        isLoading={adjustBalanceMutation.isPending}
      />
    </div>
  )
}

export default TransactionsPage
