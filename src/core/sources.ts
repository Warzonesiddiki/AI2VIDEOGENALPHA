/**
 * Advisory checks for research notes. These functions do not fetch sources.
 * Literal-host screening does not validate DNS, redirects or all reserved IP ranges,
 * and pattern matching cannot prove text safe from prompt injection. Never use
 * either result as authorization for network access, tools, or approvals.
 */

export interface SourceValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  isBlockedSsrf: boolean;
  containsPromptInjection: boolean;
  warnings: string[];
}

/**
 * Checks whether an IP or hostname is private/loopback/cloud metadata.
 */
function isPrivateOrReservedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');
  // Until a full IP policy is available, reject all IPv6 literal research targets.
  if (lower.includes(':')) return true;

  // Common localhost/loopback representations
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 link-local metadata)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = lower.match(ipv4Regex);
  if (match) {
    const b1 = parseInt(match[1], 10);
    const b2 = parseInt(match[2], 10);

    if (b1 === 10) return true; // 10.0.0.0/8
    if (b1 === 127) return true; // 127.0.0.0/8 loopback
    if (b1 === 169 && b2 === 254) return true; // 169.254.0.0/16 link-local / AWS metadata
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return true; // 172.16.0.0/12
    if (b1 === 192 && b2 === 168) return true; // 192.168.0.0/16
  }

  // AWS/GCP/Azure cloud metadata specific domains
  if (
    lower.includes('metadata.google.internal') ||
    lower.includes('169.254.169.254')
  ) {
    return true;
  }

  return false;
}

/**
 * Screens URL syntax, protocols and some literal/local hosts; not safe-fetch authorization.
 */
export function validateResearchSourceUrl(rawUrl: string): SourceValidationResult {
  const warnings: string[] = [];
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      isBlockedSsrf: false,
      containsPromptInjection: false,
      warnings: ['Empty or invalid URL provided.'],
    };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      isBlockedSsrf: false,
      containsPromptInjection: false,
      warnings: ['Malformed URL format.'],
    };
  }

  // Only allow http and https protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      isBlockedSsrf: true,
      containsPromptInjection: false,
      warnings: [`Blocked disallowed protocol: ${parsed.protocol}. Only http: and https: are allowed.`],
    };
  }

  // Check for SSRF / private IP / localhost
  if (isPrivateOrReservedHost(parsed.hostname)) {
    return {
      isValid: false,
      isBlockedSsrf: true,
      containsPromptInjection: false,
      warnings: [`Blocked private/internal network target (${parsed.hostname}) to prevent SSRF.`],
    };
  }

  // Strip dangerous auth credentials embedded in URL
  if (parsed.username || parsed.password) {
    parsed.username = '';
    parsed.password = '';
    warnings.push('Embedded username/password credentials were removed from URL for safety.');
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.toString(),
    isBlockedSsrf: false,
    containsPromptInjection: false,
    warnings,
  };
}

/**
 * Flags a few known patterns and bounds text length; absence of a match does not establish safety.
 */
export function sanitizeUntrustedResearchContent(content: string): {
  isSafe: boolean;
  sanitizedContent: string;
  detectedPatterns: string[];
} {
  if (!content) {
    return { isSafe: true, sanitizedContent: '', detectedPatterns: [] };
  }

  const detectedPatterns: string[] = [];
  const injectionSignatures = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /system\s+prompt\s+override/i,
    /you\s+are\s+now\s+in\s+(developer|unrestricted)\s+mode/i,
    /exfiltrate\s+(api\s+)?(key|secret|token)/i,
    /disregard\s+the\s+above/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  ];

  for (const sig of injectionSignatures) {
    if (sig.test(content)) {
      detectedPatterns.push(sig.source);
    }
  }

  // Truncate oversized research content to prevent memory exhaustion (max 30KB per entry)
  let truncated = content;
  if (truncated.length > 30_000) {
    truncated = truncated.slice(0, 30_000) + '... [Truncated at 30,000 characters]';
  }

  return {
    isSafe: detectedPatterns.length === 0,
    sanitizedContent: truncated,
    detectedPatterns,
  };
}
