'use client'

interface ToggleProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}

export default function Toggle({ checked, onChange, disabled = false, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full p-1 transition-colors duration-200 disabled:opacity-60 ${
        checked ? 'bg-accent' : 'bg-border'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-5 w-5 rounded-full bg-white shadow-soft transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
