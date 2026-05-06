import { useSearchParams } from 'react-router-dom';
import { parseSystmOneTimestamp, isUrlExpired } from './dateHelpers';

export type LinkExpiry = {
  value: number;
  unit: 'weeks' | 'months';
};

/**
 * Returns true if the SystmOne timestamp embedded in the `codes` URL param
 * is older than the configured expiry window. Returns false if no expiry is
 * configured or no valid timestamp is present in the URL.
 */
export function useUrlExpiry(expiry: LinkExpiry | undefined): boolean {
  const [searchParams] = useSearchParams();
  if (!expiry?.value) return false;
  const timestamp = parseSystmOneTimestamp(searchParams.get('codes'));
  if (!timestamp) return false;
  return isUrlExpired(timestamp, expiry.value, expiry.unit);
}
