/**
 * Format duration in seconds to human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2m 30s", "1h 15m")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

/**
 * Format date to ISO timestamp string
 * @param date - Date object to format
 * @returns ISO timestamp string
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Truncate text to specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 * @throws Error if maxLength is less than 1
 */
export function truncateText(text: string, maxLength: number): string {
  if (maxLength < 1) {
    throw new Error('maxLength must be at least 1');
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  // If maxLength <= 3, return substring without ellipsis
  if (maxLength <= 3) {
    return text.substring(0, maxLength);
  }
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format bytes to human-readable string with appropriate units
 * @param bytes - Number of bytes to format
 * @returns Formatted string with units (B, KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

