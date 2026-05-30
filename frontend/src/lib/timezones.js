// Use the browser's Intl API to get all valid IANA timezone names
// Falls back to a curated list if the browser doesn't support it
export function getAllTimezones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for older browsers
    return [
      'UTC',
      'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
      'America/Anchorage', 'America/Chicago', 'America/Denver',
      'America/Los_Angeles', 'America/New_York', 'America/Phoenix',
      'America/Sao_Paulo', 'America/Toronto', 'America/Vancouver',
      'Asia/Bangkok', 'Asia/Colombo', 'Asia/Dubai', 'Asia/Hong_Kong',
      'Asia/Jakarta', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kuwait',
      'Asia/Manila', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore',
      'Asia/Taipei', 'Asia/Tehran', 'Asia/Tokyo',
      'Australia/Brisbane', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
      'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Brussels',
      'Europe/Dublin', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Lisbon',
      'Europe/London', 'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo',
      'Europe/Paris', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna',
      'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu',
    ];
  }
}

// Group timezones by region for a nicer select UX
export function getGroupedTimezones() {
  const all = getAllTimezones();
  const groups = {};
  all.forEach((tz) => {
    const region = tz.includes('/') ? tz.split('/')[0] : 'Other';
    if (!groups[region]) groups[region] = [];
    groups[region].push(tz);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export function getCurrentTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}
