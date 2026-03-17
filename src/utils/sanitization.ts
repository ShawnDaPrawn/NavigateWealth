/**
 * Sanitizes an object to remove large strings (like Base64 images) using JSON serialization
 * This is much faster and safer than manual recursion
 */
export function deepSanitize<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;

  const replacer = (_key: string, value: unknown): unknown => {
    // Pass through non-strings
    if (typeof value !== 'string') return value;

    // Allow long strings for specific keys that might be URLs or paths
    if (_key === 'fileUrl' || _key === 'path' || _key === 'url' || _key === 'href') {
      // CRITICAL SECURITY FIX: Never allow data: URIs even in these allowed fields
      if (value.startsWith('data:')) {
        return undefined;
      }
      return value;
    }

    // Check for Base64 or excessive length
    // 5000 chars is roughly 5-10KB, which is plenty for normal text but small for images
    if (value.startsWith('data:') || value.length > 5000) {
      return undefined; // Remove the property
    }

    return value;
  };

  try {
    return JSON.parse(JSON.stringify(obj, replacer));
  } catch (error) {
    console.error('Sanitization failed:', error);
    // Fallback: return original object if serialization fails (unlikely for plain data)
    return obj;
  }
}