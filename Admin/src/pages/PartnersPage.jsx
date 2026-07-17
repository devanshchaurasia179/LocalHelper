import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { getAllPartners } from '@/api/partner.api'
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
import {
  formatDate,
  getVerificationVariant,
  getAccountVariant,
} from '@/utils/formatters'

const VERIFICATION_OPTIONS = [
  { label: 'Pending',      value: 'Pending' },
  { label: 'Under Review', value: 'Under Review' },
  { label: 'Approved',     value: 'Approved' },
  { label: 'Rejected',     value: 'Rejected' },
]

const ACCOUNT_OPTIONS = [
  { label: 'Active',    value: 'Active' },
  { label: 'Blocked',   value: 'Blocked' },
  { label: 'Suspended', value: 'Suspended' },
]

const SORT_OPTIONS = [
  { label: 'Newest first',  value: 'createdAt_desc' },
  { label: 'Oldest first',  value: 'createdAt_asc' },
  { label: 'Name A–Z',      value: 'fullName_asc' },
  { label: 'Name Z–A',      value: 'fullName_desc' },
]

const PartnersPage = () => {
  const navigate = useNavigate()

  const [page,               setPage]               = useState(1)
  const [search,             setSearch]             = useState('')
  const [verificationStatus, setVerificationStatus] = useState(undefined)
  const [accountStatus,      setAccountStatus]      = useState(undefined)
  const [sort,               setSort]               = useState('createdAt_desc')

  const [sortBy, sortOrder] = sort.split('_')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['partners', page, search, verificationStatus, accountStatus, sortBy, sortOrder],
    queryFn: () =>
      getAllPartners({ page, limit: 10, search, verificationStatus, accountStatus, sortBy, sortOrder }),
    keepPreviousData: true,
  })

  const handleSearch = useCallback((v) => {
    setSearch(v)
    setPage(1)
  }, [])

  const handleClearFilters = () => {
    setSearch('')
    setVerificationStatus(undefined)
    setAccountStatus(undefined)
    setSort('createdAt_desc')
    setPage(1)
  }

  const hasFilters = search || verificationStatus || accountStatus

  const partners   = data?.partners || []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Partners"
        subtitle={pagination ? `${pagination.total} partners registered` : 'Manage all service partners'}
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
            value={verificationStatus}
            onChange={(v) => { setVerificationStatus(v); setPage(1) }}
            options={VERIFICATION_OPTIONS}
            placeholder="Verification"
          />
          <FilterDropdown
            value={accountStatus}
            onChange={(v) => { setAccountStatus(v); setPage(1) }}
            options={ACCOUNT_OPTIONS}
            placeholder="Account status"
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
          <table className="w-full text-sm" role="table" aria-label="Partners table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Partner', 'Phone', 'City', 'Service', 'Verification', 'Account', 'Joined', 'Actions'].map(
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
                  <Skeleton.TableRow key={i} cols={8} />
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={8}>
                    <ErrorState
                      message="Could not load partners."
                      onRetry={refetch}
                    />
                  </td>
                </tr>
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState.NoResults onClear={hasFilters ? handleClearFilters : undefined} />
                  </td>
                </tr>
              ) : (
                partners.map((partner, i) => (
                  <motion.tr
                    key={partner._id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    {/* Partner */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={partner.profilePhoto}
                          name={partner.fullName}
                          size="sm"
                        />
                        <span className="font-medium text-slate-800 truncate max-w-[140px]">
                          {partner.fullName}
                        </span>
                      </div>
                    </td>
                    {/* Phone */}
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {partner.phone}
                    </td>
                    {/* City */}
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {partner.address?.city || '—'}
                    </td>
                    {/* Service categories */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {partner.categories?.length > 0 ? (
                          <>
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {partner.categories[0].name}
                            </span>
                            {partner.categories.length > 1 && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                +{partner.categories.length - 1}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    {/* Verification */}
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={partner.verificationStatus}
                        variant={getVerificationVariant(partner.verificationStatus)}
                      />
                    </td>
                    {/* Account */}
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={partner.accountStatus}
                        variant={getAccountVariant(partner.accountStatus)}
                      />
                    </td>
                    {/* Joined */}
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {formatDate(partner.createdAt)}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => navigate(`/partners/${partner._id}`)}
                        aria-label={`View ${partner.fullName}`}
                      >
                        View
                      </Button>
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
    </div>
  )
}

export default PartnersPage
