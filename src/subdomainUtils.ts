type Subdomain = 'admin' | 'practice' | null;

export function getSubdomain(): Subdomain {
  const hostname = window.location.hostname;
  if (hostname.startsWith('admin.')) return 'admin';
  if (hostname.startsWith('practice.')) return 'practice';
  return null;
}

/**
 * Resolves a navigation path for the current subdomain context.
 * On the main domain, paths like /admin/dashboard work as-is.
 * On admin.mymedinfo.info, /admin/dashboard becomes /dashboard.
 * On practice.mymedinfo.info, /practice/dashboard becomes /dashboard.
 */
export function resolvePath(path: string): string {
  const sub = getSubdomain();
  if (sub === 'admin' && path.startsWith('/admin')) {
    const stripped = path.replace(/^\/admin/, '') || '/';
    return stripped;
  }
  if (sub === 'practice' && path.startsWith('/practice')) {
    const stripped = path.replace(/^\/practice/, '') || '/';
    return stripped;
  }
  return path;
}

/** Get the full URL for the admin portal. */
export function adminUrl(path = '/'): string {
  const sub = getSubdomain();
  if (sub === 'admin') return path;
  // On main domain or practice subdomain, link to admin subdomain
  const hostname = window.location.hostname;
  if (hostname.includes('mymedinfo.info')) {
    return `https://admin.mymedinfo.info${path}`;
  }
  // Local dev fallback
  return `/admin${path === '/' ? '' : path}`;
}

/** Get the full URL for the practice portal. */
export function practiceUrl(path = '/'): string {
  const sub = getSubdomain();
  if (sub === 'practice') return path;
  const hostname = window.location.hostname;
  if (hostname.includes('mymedinfo.info')) {
    return `https://practice.mymedinfo.info${path}`;
  }
  return `/practice${path === '/' ? '' : path}`;
}
