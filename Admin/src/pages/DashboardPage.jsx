import { useQuery } from '@tanstack/react-query'
import {
  Users,
  ShieldCheck,
  Clock,
  XCircle,
  CalendarDays,
  TrendingUp,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import StatusBadge from '@/components/ui/StatusBadge'
import Skeleton from '@/components/ui/Skeleton'
import ErrorState from '@/components/ui/ErrorState'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import { getDashboardStats, getLatestPartners, getLatestPendingVerifications } from '@/api/dashboard.api'
import { formatDate, getVerificationVariant, formatCompact } from '@/utils/formatters'

const PIE_COLORS = {
  Approved:       '#10b981',
  Pending:        '#f59e0b',
  'Under Review': '#3b82f6',
  Rejected:       '#ef4444',
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// Custom recharts tooltip
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-0.5">{label}</p>
      <p className="text-primary-600">{payload[0].value} partners</p>
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700">{payload[0].name}</p>
      <p className="text-slate-500">{payload[0].value} partners</p>
    </div>
  )
}

const DashboardPage = () => {
  const navigate = useNavigate()

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn:  getDashboardStats,
  })

  const {
    data: latestPartners = [],
    isLoading: partnersLoading,
  } = useQuery({
    queryKey: ['latestPartners'],
    queryFn:  () => getLatestPartners(6),
  })

  const {
    data: pendingVerifications = [],
    isLoading: pendingLoading,
  } = useQuery({
    queryKey: ['latestPending'],
    queryFn:  () => getLatestPendingVerifications(6),
  })

  // Pie chart data — filter out zero-value slices so the chart stays clean
  const pieData = stats
    ? [
        { name: 'Approved',       value: stats.approvedPartners },
        { name: 'Pending',        value: stats.pendingPartners  },
        { name: 'Rejected',       value: stats.rejectedPartners },
      ].filter((d) => d.value > 0)
    : []

  // Bar chart — placeholder monthly data; a real endpoint would supply this
  const barData = [
    { month: 'Feb', partners: 12 },
    { month: 'Mar', partners: 19 },
    { month: 'Apr', partners: 25 },
    { month: 'May', partners: 31 },
    { month: 'Jun', partners: 28 },
    {
      month: 'Jul',
      partners: stats?.totalPartners
        ? Math.max(1, Math.floor(stats.totalPartners * 0.12))
        : 0,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Platform overview and recent activity"
      />

      {/* ── Stat cards ──────────────────────────────────────────── */}
      {statsError ? (
        <ErrorState
          message="Could not load platform stats."
          onRetry={refetchStats}
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {[
            {
              title:        'Total Partners',
              value:        statsLoading ? '—' : formatCompact(stats?.totalPartners ?? 0),
              icon:         Users,
              iconColor:    'bg-primary-50',
              iconText:     'text-primary-600',
            },
            {
              title:        'Verified Partners',
              value:        statsLoading ? '—' : formatCompact(stats?.approvedPartners ?? 0),
              icon:         ShieldCheck,
              iconColor:    'bg-emerald-50',
              iconText:     'text-emerald-600',
            },
            {
              title:        'Pending Review',
              value:        statsLoading ? '—' : formatCompact(stats?.pendingPartners ?? 0),
              icon:         Clock,
              iconColor:    'bg-amber-50',
              iconText:     'text-amber-600',
            },
            {
              title:        'Rejected',
              value:        statsLoading ? '—' : formatCompact(stats?.rejectedPartners ?? 0),
              icon:         XCircle,
              iconColor:    'bg-red-50',
              iconText:     'text-red-500',
            },
          ].map((card) => (
            <motion.div key={card.title} variants={fadeUp}>
              <StatCard
                title={card.title}
                value={card.value}
                icon={card.icon}
                iconColor={card.iconColor}
                iconTextColor={card.iconText}
                loading={statsLoading}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Charts ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <Card className="lg:col-span-2">
          <Card.Header>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Partner Growth</h2>
                <p className="text-xs text-slate-400 mt-0.5">Monthly new registrations</p>
              </div>
              <TrendingUp className="w-4 h-4 text-slate-300" aria-hidden="true" />
            </div>
          </Card.Header>
          <Card.Body className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="partners" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>

        {/* Pie chart */}
        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-800">Verification Breakdown</h2>
            <p className="text-xs text-slate-400 mt-0.5">Current status distribution</p>
          </Card.Header>
          <Card.Body className="flex flex-col items-center pt-2">
            {statsLoading ? (
              <Skeleton className="w-36 h-36 rounded-full mx-auto" />
            ) : pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={PIE_COLORS[entry.name] || '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 w-full mt-1">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PIE_COLORS[entry.name] }}
                          aria-hidden="true"
                        />
                        <span className="text-xs text-slate-500">{entry.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 tabular-nums">
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 py-10">No partner data yet</p>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* ── Activity feeds ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latest registrations */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Latest Registrations</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/partners')}>
                View all
              </Button>
            </div>
          </Card.Header>
          <FeedList
            items={latestPartners}
            loading={partnersLoading}
            renderItem={(p) => (
              <PartnerFeedRow
                key={p._id}
                partner={p}
                onClick={() => navigate(`/partners/${p._id}`)}
                right={
                  <StatusBadge
                    label={p.verificationStatus}
                    variant={getVerificationVariant(p.verificationStatus)}
                  />
                }
              />
            )}
            emptyText="No partners registered yet"
          />
        </Card>

        {/* Pending verifications */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Pending Verifications</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/verification')}>
                Review all
              </Button>
            </div>
          </Card.Header>
          <FeedList
            items={pendingVerifications}
            loading={pendingLoading}
            renderItem={(p) => (
              <PartnerFeedRow
                key={p._id}
                partner={p}
                onClick={() => navigate(`/partners/${p._id}`)}
                right={
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {formatDate(p.createdAt)}
                  </span>
                }
              />
            )}
            emptyText="No pending verifications 🎉"
          />
        </Card>
      </div>
    </div>
  )
}

// ── Feed helpers ─────────────────────────────────────────────────────

const FeedList = ({ items, loading, renderItem, emptyText }) => (
  <div className="divide-y divide-slate-50 min-h-[120px]">
    {loading ? (
      Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-6 py-3.5">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))
    ) : items.length === 0 ? (
      <p className="text-sm text-slate-400 text-center py-10">{emptyText}</p>
    ) : (
      items.map(renderItem)
    )}
  </div>
)

const PartnerFeedRow = ({ partner, onClick, right }) => (
  <div
    className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick()}
    aria-label={`View ${partner.fullName}`}
  >
    <Avatar src={partner.profilePhoto} name={partner.fullName} size="sm" className="flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-primary-700 transition-colors">
        {partner.fullName}
      </p>
      <p className="text-xs text-slate-400 truncate">{partner.address?.city || partner.phone}</p>
    </div>
    {right}
  </div>
)

export default DashboardPage
