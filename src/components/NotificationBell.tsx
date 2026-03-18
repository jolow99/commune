'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Notification } from '@/lib/types'

interface NotificationBellProps {
  userId: string
  onOpenInterview?: () => void
}

export default function NotificationBell({ userId, onOpenInterview }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read).length

  const loadNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`)
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }, [userId])

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    }).catch(console.error)
  }

  if (notifications.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-slate-400 hover:text-white transition-colors p-1"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-8 z-50 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-700">
              <h3 className="text-xs font-semibold text-slate-400">Notifications</h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-3 py-2 border-b border-slate-800 ${!n.read ? 'bg-slate-800/50' : ''}`}
                >
                  <p className="text-xs text-slate-300">
                    {(n.payload as { message?: string })?.message || 'New notification'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-[10px] text-slate-500 hover:text-slate-300"
                      >
                        Mark read
                      </button>
                    )}
                    {n.type === 'merge_feedback' && onOpenInterview && (
                      <button
                        onClick={() => { markRead(n.id); setIsOpen(false); onOpenInterview() }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300"
                      >
                        Share feedback
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
