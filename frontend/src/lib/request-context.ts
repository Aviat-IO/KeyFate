import { AsyncLocalStorage } from "async_hooks"

interface RequestContext {
  requestId: string
  jobName?: string
  userId?: string
  startTime: number
}

const requestContext = new AsyncLocalStorage<RequestContext>()

export function withRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return requestContext.run(context, fn)
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore()
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId
}

export function getJobName(): string | undefined {
  return requestContext.getStore()?.jobName
}

export function getUserId(): string | undefined {
  return requestContext.getStore()?.userId
}
