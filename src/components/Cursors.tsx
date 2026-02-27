'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import usePartySocket from 'partysocket/react'

type Cursor = {
  x: number
  y: number
  country: string
}

function countryToFlag(code: string): string {
  if (!code || code.length !== 2 || code === 'UN') return '🏳️'
  const upper = code.toUpperCase()
  return String.fromCodePoint(
    ...Array.from(upper).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

export default function Cursors() {
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map())
  const lastSent = useRef(0)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Briefly hide overlay so the event reaches elements underneath (iframe, buttons, etc.)
  const passThrough = useCallback(() => {
    if (!overlayRef.current) return
    overlayRef.current.style.pointerEvents = 'none'
    requestAnimationFrame(() => {
      if (overlayRef.current) {
        overlayRef.current.style.pointerEvents = 'auto'
      }
    })
  }, [])

  const ws = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999',
    room: 'cursors',
    party: 'cursors',
    onMessage(evt) {
      const msg = JSON.parse(evt.data)
      if (msg.type === 'update') {
        setCursors((prev) => {
          const next = new Map(prev)
          next.set(msg.id, { x: msg.x, y: msg.y, country: msg.country })
          return next
        })
      } else if (msg.type === 'remove') {
        setCursors((prev) => {
          const next = new Map(prev)
          next.delete(msg.id)
          return next
        })
      }
    },
  })

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const now = Date.now()
      if (now - lastSent.current < 50) return
      lastSent.current = now

      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      ws.send(JSON.stringify({ x, y }))
    },
    [ws]
  )

  useEffect(() => {
    document.addEventListener('pointermove', handlePointerMove)
    return () => document.removeEventListener('pointermove', handlePointerMove)
  }, [handlePointerMove])

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Transparent overlay to capture pointer events over iframes.
          On click/scroll, briefly hide so the event reaches elements below. */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-auto z-50"
        style={{ cursor: 'default' }}
        onPointerMove={(e) => {
          const now = Date.now()
          if (now - lastSent.current < 50) return
          lastSent.current = now
          const x = (e.clientX / window.innerWidth) * 100
          const y = (e.clientY / window.innerHeight) * 100
          ws.send(JSON.stringify({ x, y }))
        }}
        onPointerDown={passThrough}
        onWheel={passThrough}
        onContextMenu={passThrough}
      />
      {Array.from(cursors.entries()).map(([id, cursor]) => (
        <div
          key={id}
          className="absolute transition-all duration-100 ease-out"
          style={{
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
            transform: 'translate(-4px, -4px)',
          }}
        >
          {/* Cursor arrow */}
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            className="drop-shadow-md"
          >
            <path
              d="M0 0L16 12H8L6 20L0 0Z"
              fill="#818cf8"
              stroke="#312e81"
              strokeWidth="1"
            />
          </svg>
          {/* Flag label */}
          <span className="absolute left-4 top-3 text-base select-none">
            {countryToFlag(cursor.country)}
          </span>
        </div>
      ))}
    </div>
  )
}
