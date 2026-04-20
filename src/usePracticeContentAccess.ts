import { useEffect, useState } from 'react';
import { validateOrganisation } from './protocolService';
import { PRACTICE_FEATURE_METADATA, type PracticeFeatureKey } from './practiceFeatures';

type PracticeContentAccessState = {
  loading: boolean;
  allowed: boolean;
  error: string;
};

export function usePracticeContentAccess(
  orgName: string,
  featureKey: PracticeFeatureKey,
  options?: { skip?: boolean },
): PracticeContentAccessState {
  const skip = options?.skip === true;
  const trimmedOrgName = orgName.trim();
  const [state, setState] = useState<PracticeContentAccessState>({ loading: false, allowed: true, error: '' });

  useEffect(() => {
    if (skip || !trimmedOrgName) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState({ loading: true, allowed: false, error: '' });
      const result = await validateOrganisation(trimmedOrgName);
      if (cancelled) return;

      if (!result.valid) {
        setState({
          loading: false,
          allowed: false,
          error: result.error || 'This practice is not registered with MyMedInfo.',
        });
        return;
      }

      if (!result.practiceFeatures[featureKey]) {
        setState({
          loading: false,
          allowed: false,
          error: `${PRACTICE_FEATURE_METADATA[featureKey].label} are not enabled for this practice yet.`,
        });
        return;
      }

      setState({ loading: false, allowed: true, error: '' });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [featureKey, skip, trimmedOrgName]);

  if (skip || !trimmedOrgName) {
    return { loading: false, allowed: true, error: '' };
  }

  return state;
}
