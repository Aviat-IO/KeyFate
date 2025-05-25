import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useToast, reducer } from "@/hooks/use-toast"

// Mock timers for testing timeouts
vi.useFakeTimers()

describe("useToast Hook", () => {
  beforeEach(() => {
    vi.clearAllTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.useFakeTimers()
  })

  it("should initialize with empty toasts", () => {
    const { result } = renderHook(() => useToast())

    expect(result.current.toasts).toEqual([])
  })

  it("should add a toast", () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({
        title: "Test Toast",
        description: "This is a test toast",
      })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].title).toBe("Test Toast")
    expect(result.current.toasts[0].description).toBe("This is a test toast")
    expect(result.current.toasts[0].open).toBe(true)
  })

  it("should dismiss a specific toast", () => {
    const { result } = renderHook(() => useToast())

    let toastId: string

    act(() => {
      const toast = result.current.toast({
        title: "Test Toast",
      })
      toastId = toast.id
    })

    expect(result.current.toasts[0].open).toBe(true)

    act(() => {
      result.current.dismiss(toastId)
    })

    expect(result.current.toasts[0].open).toBe(false)
  })

  it("should dismiss all toasts when no ID provided", () => {
    const { result } = renderHook(() => useToast())

    // First clear any existing toasts
    act(() => {
      result.current.dismiss()
    })

    act(() => {
      result.current.toast({ title: "Toast 1" })
      result.current.toast({ title: "Toast 2" })
    })

    // Filter only the toasts we just added (they should be the most recent ones)
    const currentToasts = result.current.toasts.filter(
      (t) => t.title === "Toast 1" || t.title === "Toast 2",
    )

    expect(currentToasts).toHaveLength(2)
    expect(currentToasts.every((t) => t.open)).toBe(true)

    act(() => {
      result.current.dismiss()
    })

    const dismissedToasts = result.current.toasts.filter(
      (t) => t.title === "Toast 1" || t.title === "Toast 2",
    )
    expect(dismissedToasts.every((t) => !t.open)).toBe(true)
  })

  it("should limit toasts to maximum of 3", () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ title: "Toast 1" })
      result.current.toast({ title: "Toast 2" })
      result.current.toast({ title: "Toast 3" })
      result.current.toast({ title: "Toast 4" })
    })

    expect(result.current.toasts).toHaveLength(3)
    expect(result.current.toasts[0].title).toBe("Toast 4") // Most recent first
  })

  it("should return toast control functions", () => {
    const { result } = renderHook(() => useToast())

    let toastControls: any

    act(() => {
      toastControls = result.current.toast({
        title: "Controllable Toast",
      })
    })

    expect(toastControls).toHaveProperty("id")
    expect(toastControls).toHaveProperty("dismiss")
    expect(toastControls).toHaveProperty("update")
    expect(typeof toastControls.dismiss).toBe("function")
    expect(typeof toastControls.update).toBe("function")
  })

  it("should update a toast", () => {
    const { result } = renderHook(() => useToast())

    let toastControls: any

    act(() => {
      toastControls = result.current.toast({
        title: "Original Title",
      })
    })

    act(() => {
      toastControls.update({
        title: "Updated Title",
        description: "New description",
      })
    })

    expect(result.current.toasts[0].title).toBe("Updated Title")
    expect(result.current.toasts[0].description).toBe("New description")
  })

  it("should handle onOpenChange callback", () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({
        title: "Test Toast",
      })
    })

    const toast = result.current.toasts[0]
    expect(toast.open).toBe(true)

    act(() => {
      toast.onOpenChange?.(false)
    })

    expect(result.current.toasts[0].open).toBe(false)
  })
})

describe("Toast Reducer", () => {
  const initialState = { toasts: [] }

  it("should add a toast", () => {
    const toast = {
      id: "1",
      title: "Test Toast",
      open: true,
    }

    const action = {
      type: "ADD_TOAST" as const,
      toast,
    }

    const newState = reducer(initialState, action)

    expect(newState.toasts).toHaveLength(1)
    expect(newState.toasts[0]).toEqual(toast)
  })

  it("should update a toast", () => {
    const initialToast = {
      id: "1",
      title: "Original",
      open: true,
    }

    const stateWithToast = { toasts: [initialToast] }

    const action = {
      type: "UPDATE_TOAST" as const,
      toast: {
        id: "1",
        title: "Updated",
      },
    }

    const newState = reducer(stateWithToast, action)

    expect(newState.toasts[0].title).toBe("Updated")
    expect(newState.toasts[0].id).toBe("1")
  })

  it("should dismiss a specific toast", () => {
    const toast = {
      id: "1",
      title: "Test",
      open: true,
    }

    const stateWithToast = { toasts: [toast] }

    const action = {
      type: "DISMISS_TOAST" as const,
      toastId: "1",
    }

    const newState = reducer(stateWithToast, action)

    expect(newState.toasts[0].open).toBe(false)
  })

  it("should remove a toast", () => {
    const toast = {
      id: "1",
      title: "Test",
      open: true,
    }

    const stateWithToast = { toasts: [toast] }

    const action = {
      type: "REMOVE_TOAST" as const,
      toastId: "1",
    }

    const newState = reducer(stateWithToast, action)

    expect(newState.toasts).toHaveLength(0)
  })

  it("should remove all toasts when no ID provided", () => {
    const toasts = [
      { id: "1", title: "Toast 1", open: true },
      { id: "2", title: "Toast 2", open: true },
    ]

    const stateWithToasts = { toasts }

    const action = {
      type: "REMOVE_TOAST" as const,
      toastId: undefined,
    }

    const newState = reducer(stateWithToasts, action)

    expect(newState.toasts).toHaveLength(0)
  })
})
