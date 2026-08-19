import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, AlertCircle, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDateTime } from '@/utils/formatters'
import { getCallRecording } from '@/api/call.api'

/**
 * Format seconds into MM:SS display.
 */
const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * RecordingPlayerModal — plays call recordings using a temporary signed URL.
 *
 * Props:
 *   isOpen      — modal visibility
 *   onClose     — close handler
 *   call        — call object from the table (used for display info)
 */
const RecordingPlayerModal = ({ isOpen, onClose, call }) => {
  const audioRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [recordingData, setRecordingData] = useState(null)

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)

  // Fetch signed URL when modal opens
  useEffect(() => {
    if (isOpen && call?._id) {
      fetchRecording()
    }

    return () => {
      // Cleanup when closing
      if (!isOpen) {
        cleanupPlayer()
      }
    }
  }, [isOpen, call?._id])

  const fetchRecording = async () => {
    setLoading(true)
    setError(null)
    setAudioUrl(null)
    setRecordingData(null)

    try {
      const data = await getCallRecording(call._id)

      if (data.success && data.url) {
        setAudioUrl(data.url)
        setRecordingData(data)
      } else {
        setError(data.message || 'Recording not available')
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to load recording.'
      const recordingStatus = err.response?.data?.recordingStatus

      if (recordingStatus === 'processing') {
        setError('Recording is still being processed.')
      } else if (recordingStatus === 'failed') {
        setError('Recording failed.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const cleanupPlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setAudioUrl(null)
    setRecordingData(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError(null)
  }

  const handleClose = () => {
    cleanupPlayer()
    onClose()
  }

  // Audio event handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleAudioError = () => {
    setIsPlaying(false)
    setError('Playback failed. The URL may have expired. Click "Retry" to get a new link.')
  }

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(() => {
        setError('Unable to play audio.')
      })
      setIsPlaying(true)
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    audioRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const fraction = Math.max(0, Math.min(1, x / rect.width))
    audioRef.current.currentTime = fraction * duration
    setCurrentTime(fraction * duration)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Display data — prefer data from the recording response, fall back to table data
  const customerName = recordingData?.call?.customer?.name || call?.customer?.name || 'Customer'
  const partnerName = recordingData?.call?.partner?.fullName || call?.partner?.fullName || 'Partner'
  const callDate = recordingData?.call?.startedAt || call?.startedAt || call?.createdAt
  const callDuration = recordingData?.call?.callDuration || call?.duration

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Call Recording" size="md">
      <div className="px-6 py-5 space-y-5">
        {/* Call info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-400 text-xs">Customer</span>
            <p className="font-medium text-slate-800">{customerName}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Partner</span>
            <p className="font-medium text-slate-800">{partnerName}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Date</span>
            <p className="font-medium text-slate-700">{formatDateTime(callDate)}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Call Duration</span>
            <p className="font-medium text-slate-700">{formatDuration(callDuration)}</p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
            <span className="text-sm text-slate-500">Loading recording...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className="p-3 rounded-full bg-red-50">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-sm text-slate-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchRecording}>
              Retry
            </Button>
          </div>
        )}

        {/* Audio player */}
        {audioUrl && !loading && !error && (
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onError={handleAudioError}
              preload="metadata"
            />

            {/* Recording duration badge */}
            {recordingData?.recording?.durationSeconds && (
              <div className="flex items-center gap-2">
                <StatusBadge
                  label={`Recording: ${formatDuration(recordingData.recording.durationSeconds)}`}
                  variant="success"
                  size="sm"
                />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors shadow-sm"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Progress bar */}
              <div className="flex-1 space-y-1">
                <div
                  className="relative h-2 bg-slate-200 rounded-full cursor-pointer group"
                  onClick={handleSeek}
                  role="slider"
                  aria-label="Seek"
                  aria-valuenow={Math.round(currentTime)}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration)}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-primary-500 rounded-full transition-[width] duration-100"
                    style={{ width: `${progress}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
                </div>
                {/* Time labels */}
                <div className="flex justify-between text-xs text-slate-400 tabular-nums">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Volume */}
              <button
                onClick={toggleMute}
                className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="md" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default RecordingPlayerModal
