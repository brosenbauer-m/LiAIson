'use client'

import { useEffect, useRef, useState } from 'react'

// A product picture with labelled callouts, like an annotated diagram. Each
// line leaves the picture at an angle and runs into its label horizontally.
// Laid out on a fixed design canvas (W × H) and scaled to fit; on narrow
// screens the labels become a list under the picture.

export const W = 760
export const H = 460
export const MOCK_W = 400
export const MOCK_H = 440
const MOCK_X = 10
const MOCK_Y = 10
const BEND_X = MOCK_X + MOCK_W + 34
const LABEL_X = 478

// ax/ay: the point on the picture (in picture pixels, 400 × 440);
// y: where the label sits on the canvas.
export type Callout = { ax: number; ay: number; y: number; title: string; text: string }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

export default function Annotated({ mock, callouts, active = true }: { mock: React.ReactNode; callouts: Callout[]; active?: boolean }) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const wide = width >= 600
  const scale = width ? Math.min(1, width / (wide ? W : MOCK_W + 2 * MOCK_X)) : 0

  return (
    <div ref={ref} className="w-full">
      {width > 0 && wide && (
        <div style={{ height: H * scale }}>
          <div className="relative origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            <div className="absolute" style={{ left: MOCK_X, top: MOCK_Y, width: MOCK_W, height: MOCK_H }}>{mock}</div>
            <svg className="absolute inset-0 pointer-events-none" width={W} height={H} aria-hidden="true">
              {callouts.map((c, i) => {
                const ax = MOCK_X + c.ax
                const ay = MOCK_Y + c.ay
                return (
                  <g key={`${i}-${active}`}>
                    <path
                      d={`M ${ax} ${ay} L ${BEND_X} ${c.y} L ${LABEL_X - 10} ${c.y}`}
                      fill="none"
                      stroke="#5C3B28"
                      strokeOpacity="0.55"
                      strokeWidth="1.25"
                      pathLength={1}
                      className={active ? 'animate-draw' : undefined}
                      style={{ animationDelay: `${150 + i * 120}ms` }}
                    />
                    <circle cx={ax} cy={ay} r="4" fill="#5C3B28" stroke="#FFFDF9" strokeWidth="2" />
                    <circle cx={LABEL_X - 10} cy={c.y} r="2" fill="#5C3B28" fillOpacity="0.55" />
                  </g>
                )
              })}
            </svg>
            {callouts.map((c, i) => (
              <div
                key={`${i}-${active}`}
                className="absolute"
                style={{ left: LABEL_X, top: c.y, width: W - LABEL_X - 6, transform: 'translateY(-50%)' }}
              >
                <div className={active ? 'animate-page-in' : undefined} style={{ animationDelay: `${300 + i * 120}ms` }}>
                  <p className="text-[15px] font-semibold text-text-primary leading-snug">{c.title}</p>
                  <p className="text-[13px] text-text-secondary leading-snug mt-0.5">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {width > 0 && !wide && (
        <div>
          <div style={{ height: (MOCK_H + 2 * MOCK_Y) * scale }}>
            <div className="origin-top-left" style={{ width: MOCK_W + 2 * MOCK_X, height: MOCK_H + 2 * MOCK_Y, padding: MOCK_Y, transform: `scale(${scale})` }}>
              <div style={{ width: MOCK_W, height: MOCK_H }}>{mock}</div>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {callouts.map(c => (
              <li key={c.title} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span className="text-sm text-text-secondary"><span className="font-semibold text-text-primary">{c.title}.</span> {c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
