import { logger } from "$lib/logger"

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number)
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  )
}

function isIpInCIDR(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split("/")
  const prefix = parseInt(prefixStr, 10)

  if (prefix < 0 || prefix > 32) {
    return false
  }

  const ipInt = ipToInt(ip)
  const networkInt = ipToInt(network)
  const mask = (0xffffffff << (32 - prefix)) >>> 0

  return (ipInt & mask) === (networkInt & mask)
}

export function isIpWhitelisted(
  clientIp: string,
  whitelist: string[],
): boolean {
  if (!whitelist || whitelist.length === 0) {
    logger.warn("IP whitelist is empty - allowing all IPs", { clientIp })
    return true
  }

  for (const allowed of whitelist) {
    if (allowed.includes("/")) {
      if (isIpInCIDR(clientIp, allowed)) {
        return true
      }
    } else {
      if (clientIp === allowed) {
        return true
      }
    }
  }

  logger.warn("IP not in whitelist", { clientIp, whitelist })
  return false
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")

  const ip = forwarded?.split(",")[0].trim() || realIp || "unknown"

  return ip
}

export function getAdminWhitelist(): string[] {
  const whitelistEnv =
    process.env.ADMIN_ALLOWED_IPS || process.env.CLOUDSQL_AUTHORIZED_NETWORKS

  if (!whitelistEnv) {
    logger.warn(
      "No admin IP whitelist configured - ADMIN_ALLOWED_IPS or CLOUDSQL_AUTHORIZED_NETWORKS not set",
    )
    return []
  }

  return whitelistEnv
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean)
}
