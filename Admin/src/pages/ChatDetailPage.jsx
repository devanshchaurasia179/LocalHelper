import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Phone,
  User,
  Clock,
  Lock,
  Image as ImageIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { getConversationMessages, closeConversation } from '@/api/chat.api'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { formatDateTime } from '@/utils/formatters'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

// ── Message bubble ──────────────────────────────────────────────────

const MessageBubble = ({ msg, customerName, partnerName }) => {
  const isCustomer = msg.senderType === 'customer'
  const isDeleted  = msg.isDeleted
  const senderLabel = isCustomer ? customerName : partnerName

  return (
    <div
      className={cn(
        'flex gap-2.5 max-w-[75%]',
        isCustomer ? 'self-start' : 'self-end flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
            isCustomer
              ? 'bg-blue-100 text-blue-700'
              : 'bg-violet-100 text-violet-700'
          )}
          aria-hidden="true"
        >
          {senderLabel?.charAt(0)?.toUpperCase() || '?'}
        </div>
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            'text-xs font-medium mb-0.5',
            isCustomer ? 'text-blue-600 text-left' : 'text-violet-600 text-right'
          )}
        >
          {senderLabel}
        </span>

        <div
          className={cn(
            'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed max-w-sm break-words',
            isDeleted
              ? 'bg-slate-100 text-slate-400 italic border border-dashed border-slate-300'
              : isCustomer
              ? 'bg-blue-50 text-slate-800 border border-blue-100'
              : 'bg-violet-50 text-slate-800 border border-violet-100'
          )}
        >
          {isDeleted ? (
            <span className="flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Message deleted
            </span>
          ) : msg.mediaUrl ? (
            <div className="space-y-1.5">
              <a
                href={msg.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                aria-label="View attached image"
              >
                <img
                  src={msg.mediaUrl}
                  alt="Attachment"
                  className="rounded-xl max-w-[220px] max-h-[220px] object-cover border border-slate-200"
                  loading="lazy"
                />
              </a>
              {msg.text && <p>{msg.text}</p>}
            </div>
          ) : (
            msg.text
          )}
        </div>

        {/* Timestamp + read */}
        <span
          className={cn(
            'text-xs text-slate-400 mt-0.5',
            isCustomer ? 'text-left' : 'text-right'
          )}
        >
          {formatDateTime(msg.createdAt)}
          {!isCustomer && (
            <span className="ml-1.5">{msg.isRead ? '✓✓' : '✓'}</span>
          )}
        </span>
      </div>
    </div>
  )
}

// ── Date separator ──────────────────────────────────────────────────

const DateSeparator = ({ date }) => (
  <div className="flex items-center gap-3 py-2" aria-label={`Messages from ${date}`}>
    <div className="flex-1 h-px bg-slate-100" />
    <span className="text-xs text-slate-400 font-medium px-2 bg-white">{date}</span>
    <div className="flex-1 h-px bg-slate-100" />
  </div>
)

// ── Helper: group messages by date ──────────────────────────────────

const groupByDate = (messages) => {
  const groups = []
  let currentDate = null

  messages.forEach((msg) => {
    const d = new Date(msg.createdAt)
    const label = new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)

    if (label !== currentDate) {
      groups.push({ type: 'separator', label, key: `sep-${label}` })
      currentDate = label
    }
    groups.push({ type: 'message', data: msg, key: msg._id })
  })

  return groups
}

// ── Main component ──────────────────────────────────────────────────

const ChatDetailPage = () => {
  const { conversationId } = useParams()
  const navigate           = useNavigate()
  const queryClient        = useQueryClient()

  const [page,        setPage]        = useState(1)
  const [closeModal,  setCloseModal]  = useState(false)

  const LIMIT = 50

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-chat-messages', conversationId, page],
    queryFn: () => getConversationMessages(conversationId, { page, limit: LIMIT }),
    enabled: !!conversationId,
    keepPreviousData: true,
  })

  const closeMutation = useMutation({
    mutationFn: () => closeConversation(conversationId),
    onSuccess: () => {
      toast.success('Conversation closed.')
      setCloseModal(false)
      queryClient.invalidateQueries(['admin-chat-messages', conversationId])
      queryClient.invalidateQueries(['admin-conversations'])
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to close conversation.')
    },
  })

  const conversation   = data?.conversation
  const messages       = data?.messages || []
  const pagination     = data?.pagination

  const customerName = conversation?.customer?.name
    || conversation?.customer?.fullName
    || 'Customer'
  const partnerName  = conversation?.partner?.fullName || 'Partner'

  const grouped = groupByDate(messages)

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !conversation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-sm text-slate-500">Conversation not found or failed to load.</p>
        <Button variant="secondary" onClick={() => navigate('/chats')}>
          Back to Chats
        </Button>
      </div>
    )
  }

  const isClosed = conversation.status === 'closed'

  return (
    <>
      <motion.div
        className="space-y-5 max-w-4xl mx-auto"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
            <div className="h-5 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <h1 className="text-base font-bold text-slate-800">
                {partnerName} &amp; {customerName}
              </h1>
              <p className="text-xs text-slate-400">
                {pagination?.total ?? 0} message{pagination?.total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge
              label={isClosed ? 'Closed' : 'Active'}
              variant={isClosed ? 'default' : 'success'}
              size="md"
            />
            {!isClosed && (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Lock className="w-3.5 h-3.5" />}
                onClick={() => setCloseModal(true)}
              >
                Close Chat
              </Button>
            )}
          </div>
        </div>

        {/* ── Participants ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Partner card */}
          <Card>
            <Card.Body className="flex items-center gap-3 py-3">
              <Avatar
                src={conversation.partner?.profilePhoto}
                name={partnerName}
                size="md"
                className="ring-2 ring-violet-100"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-0.5">
                  Partner
                </p>
                <p className="text-sm font-bold text-slate-800 truncate">{partnerName}</p>
                {conversation.partner?.phone && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {conversation.partner.phone}
                  </p>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Customer card */}
          <Card>
            <Card.Body className="flex items-center gap-3 py-3">
              <Avatar
                src={conversation.customer?.profilePhoto}
                name={customerName}
                size="md"
                className="ring-2 ring-blue-100"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">
                  Customer
                </p>
                <p className="text-sm font-bold text-slate-800 truncate">{customerName}</p>
                {conversation.customer?.phone && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {conversation.customer.phone}
                  </p>
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* ── Booking context ──────────────────────────────────── */}
        {conversation.booking && (
          <Card>
            <Card.Body className="py-3 flex items-center gap-3 text-sm text-slate-600">
              <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                Linked booking — status:{' '}
                <span className="font-medium capitalize">{conversation.booking.status}</span>
                {conversation.booking.scheduledAt && (
                  <span className="text-slate-400 ml-1.5">
                    · {formatDateTime(conversation.booking.scheduledAt)}
                  </span>
                )}
              </span>
            </Card.Body>
          </Card>
        )}

        {/* ── Message thread ───────────────────────────────────── */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Message Thread</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-3 h-3 rounded-full bg-blue-200 inline-block" /> Customer
                <span className="w-3 h-3 rounded-full bg-violet-200 inline-block ml-2" /> Partner
              </div>
            </div>
          </Card.Header>

          <Card.Body>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <ImageIcon className="w-10 h-10 text-slate-200" aria-hidden="true" />
                <p className="text-sm text-slate-500 font-medium">No messages in this conversation yet.</p>
              </div>
            ) : (
              <div
                className="flex flex-col gap-3 min-h-[300px] max-h-[600px] overflow-y-auto px-2 py-3"
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
              >
                {grouped.map((item) =>
                  item.type === 'separator' ? (
                    <DateSeparator key={item.key} date={item.label} />
                  ) : (
                    <MessageBubble
                      key={item.key}
                      msg={item.data}
                      customerName={customerName}
                      partnerName={partnerName}
                    />
                  )
                )}
              </div>
            )}
          </Card.Body>

          {/* Pagination controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {pagination.page} of {pagination.totalPages} &nbsp;·&nbsp; {pagination.total} messages
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Close conversation modal ──────────────────────────── */}
      <ConfirmModal
        isOpen={closeModal}
        onClose={() => setCloseModal(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Close Conversation"
        message={`Close the chat between ${partnerName} and ${customerName}? Neither party will be able to send further messages. This is reversible only by contacting the database.`}
        confirmLabel="Close Chat"
        confirmVariant="danger"
        isLoading={closeMutation.isPending}
      />
    </>
  )
}

export default ChatDetailPage
