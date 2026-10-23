import { createContext, useContext } from "react"

export const ToastContext = createContext({ success() {}, error() {}, info() {} })

/** const toast = useToast(); toast.success("Saved"); toast.error("Could not save") */
export function useToast() { return useContext(ToastContext) }
