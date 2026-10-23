import { useEffect, useRef, useState } from "react"

/**
 * Cheap bot protection for forms: a hidden "honeypot" field people never fill in, plus a
 * minimum fill time. Bots that auto-fill every field or submit instantly are rejected.
 *
 *   const spam = useSpamGuard()
 *   <input {...spam.trapProps} />          // inside the <form>
 *   if (spam.isBot()) return               // at the top of the submit handler
 */
export function useSpamGuard(minMs = 1000) {
  const [trap, setTrap] = useState("")
  const startedAt = useRef(0)
  useEffect(() => { startedAt.current = performance.now() }, [])
  return {
    trapProps: {
      name: "fax_number_confirm", type: "text", value: trap, tabIndex: -1, autoComplete: "off", "aria-hidden": true,
      className: "hp-field", onChange: (event) => setTrap(event.target.value)
    },
    isBot: () => trap !== "" || performance.now() - startedAt.current < minMs
  }
}
