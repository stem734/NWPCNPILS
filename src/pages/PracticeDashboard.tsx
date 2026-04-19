import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Edit2,
  Eye,
  FlaskConical,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
} from 'lucide-react';
import type { MedContent } from '../medicationData';
import { resolvePath } from '../subdomainUtils';
import MedicationPreviewModal from '../components/MedicationPreviewModal';
import ConfirmDialog from '../components/ConfirmDialog';
import DisclaimerDialog from '../components/DisclaimerDialog';
import { type MedicationRecord, useMedicationCatalog } from '../medicationCatalog';
import { getMedicationIcon } from '../medicationIcons';
import { getFunctionErrorMessage } from '../supabaseFunctionError';
import {
  CUSTOM_CARD_DISCLAIMER_TEXT,
  GLOBAL_TEMPLATE_DISCLAIMER_TEXT,
  PRACTICE_SELECTION_STORAGE_KEY,
  type PracticeMembership,
  type PracticeMedicationCardRow,
  type PracticeSummary,
} from '../practicePortal';

type PracticeMembershipRow = {
  id: string;
  practice_id: string;
  user_uid: string;
  role: 'admin' | 'editor';
  is_default: boolean;
  practice: PracticeSummary | PracticeSummary[] | null;
};

type CustomCardDraft = {
  code: string;
  title: string;
  description: string;
  badge: 'NEW' | 'REAUTH' | 'GENERAL';
  category: string;
  keyInfo: string[];
  nhsLink: string;
  trendLinks: Array<{ title: string; url: string }>;
  sickDaysNeeded: boolean;
  reviewMonths: number;
  contentReviewDate: string;
};

type DisclaimerRequest = {
  title: string;
  message: string;
  checkboxLabel: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

const EMPTY_TREND_LINK = { title: '', url: '' };

const normalisePracticeSummary = (value: PracticeSummary | PracticeSummary[] | null | undefined): PracticeSummary | null => {
  const practice = Array.isArray(value) ? value[0] : value;
  if (!practice) {
    return null;
  }

  return {
    ...practice,
    selected_medications: Array.isArray(practice.selected_medications)
      ? practice.selected_medications
      : [],
  };
};

const PracticeDashboard: React.FC = () => {
  const [memberships, setMemberships] = useState<PracticeMembership[]>([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState('');
  const [practiceCards, setPracticeCards] = useState<Record<string, PracticeMedicationCardRow>>({});
  const [loadingPortal, setLoadingPortal] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [previewMed, setPreviewMed] = useState<MedContent | null>(null);
  const [draft, setDraft] = useState<CustomCardDraft | null>(null);
  const [draftCode, setDraftCode] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDangerous: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [disclaimerRequest, setDisclaimerRequest] = useState<DisclaimerRequest | null>(null);
  const { medications: allMedications, loading: loadingMedications } = useMedicationCatalog();
  const navigate = useNavigate();

  const loadMemberships = useCallback(async () => {
    setLoadingPortal(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate(resolvePath('/practice'));
        return;
      }

      const { data, error: membershipError } = await supabase
        .from('practice_memberships')
        .select(`
          id,
          practice_id,
          user_uid,
          role,
          is_default,
          practice:practices(
            id,
            name,
            ods_code,
            contact_email,
            is_active,
            link_visit_count,
            patient_rating_count,
            patient_rating_total,
            last_accessed,
            selected_medications
          )
        `)
        .eq('user_uid', user.id)
        .order('is_default', { ascending: false });

      if (membershipError) {
        throw membershipError;
      }

      const mappedMemberships: PracticeMembership[] = (((data || []) as unknown) as PracticeMembershipRow[])
        .flatMap((row) => {
          const practice = normalisePracticeSummary(row.practice);
          if (!practice) {
            return [];
          }

          return [{
            id: row.id,
            practice_id: row.practice_id,
            user_uid: row.user_uid,
            role: row.role,
            is_default: row.is_default,
            practice,
          }];
        });

      if (mappedMemberships.length === 0) {
        setMemberships([]);
        setSelectedPracticeId('');
        setError('No practice is linked to this account. Contact your administrator.');
        return;
      }

      setMemberships(mappedMemberships);

      const savedPracticeId = window.sessionStorage.getItem(PRACTICE_SELECTION_STORAGE_KEY) || '';
      const defaultPracticeId =
        mappedMemberships.find((membership) => membership.practice_id === savedPracticeId)?.practice_id ||
        mappedMemberships.find((membership) => membership.is_default)?.practice_id ||
        mappedMemberships[0].practice_id;

      setSelectedPracticeId(defaultPracticeId);
    } catch (err) {
      console.error('Error loading practice memberships:', err);
      setError('Unable to load your practice access. Please try again.');
    } finally {
      setLoadingPortal(false);
    }
  }, [navigate]);

  const loadPracticeCards = useCallback(async (practiceId: string) => {
    setLoadingCards(true);
    setError('');

    try {
      const { data, error: cardsError } = await supabase
        .from('practice_medication_cards')
        .select('*')
        .eq('practice_id', practiceId);

      if (cardsError) {
        throw cardsError;
      }

      const nextCards = Object.fromEntries(
        (data || []).map((row: { code: string } & PracticeMedicationCardRow) => [row.code, row as PracticeMedicationCardRow]),
      );

      setPracticeCards(nextCards);
    } catch (err) {
      console.error('Error loading practice cards:', err);
      setError('Unable to load medication cards for this practice.');
    } finally {
      setLoadingCards(false);
    }
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadMemberships();
      } else {
        navigate(resolvePath('/practice'));
      }
    };

    void hydrate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        await loadMemberships();
      } else {
        navigate(resolvePath('/practice'));
      }
    });

    return () => subscription.unsubscribe();
  }, [loadMemberships, navigate]);

  useEffect(() => {
    if (!selectedPracticeId) {
      setPracticeCards({});
      return;
    }

    window.sessionStorage.setItem(PRACTICE_SELECTION_STORAGE_KEY, selectedPracticeId);
    void loadPracticeCards(selectedPracticeId);
  }, [loadPracticeCards, selectedPracticeId]);

  const selectedMembership = useMemo(
    () => memberships.find((membership) => membership.practice_id === selectedPracticeId) || null,
    [memberships, selectedPracticeId],
  );

  const selectedPractice = selectedMembership?.practice || null;

  const globalCount = useMemo(
    () => Object.values(practiceCards).filter((card) => card.source_type === 'global').length,
    [practiceCards],
  );

  const customCount = useMemo(
    () => Object.values(practiceCards).filter((card) => card.source_type === 'custom').length,
    [practiceCards],
  );

  const unconfiguredCount = Math.max(allMedications.length - Object.keys(practiceCards).length, 0);

  const legacyReviewCodes = useMemo(() => {
    if (!selectedPractice?.selected_medications) return [];

    return selectedPractice.selected_medications.filter((code) => !practiceCards[code]);
  }, [practiceCards, selectedPractice]);

  const filteredMedications = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();

    return allMedications.filter((medication) => {
      if (!query) return true;

      return [
        medication.code,
        medication.title,
        medication.description,
        medication.category,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [allMedications, librarySearch]);

  const lastAccessedLabel = selectedPractice?.last_accessed
    ? new Date(selectedPractice.last_accessed).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No patient visits yet';

  const satisfactionLabel = useMemo(() => {
    if (!selectedPractice) return 'No ratings';

    const count = selectedPractice.patient_rating_count ?? 0;
    const total = selectedPractice.patient_rating_total ?? 0;
    if (count <= 0) return 'No ratings';

    return `${(total / count).toFixed(1)}/5`;
  }, [selectedPractice]);

  const buildMedicationPreview = (medication: MedicationRecord, practiceCard?: PracticeMedicationCardRow): MedContent => {
    if (practiceCard?.source_type === 'custom') {
      return {
        code: medication.code,
        title: practiceCard.title || medication.title,
        description: practiceCard.description || medication.description,
        badge: practiceCard.badge || medication.badge,
        category: practiceCard.category || medication.category,
        keyInfo: Array.isArray(practiceCard.key_info) ? practiceCard.key_info : medication.keyInfo,
        nhsLink: typeof practiceCard.nhs_link === 'string' ? practiceCard.nhs_link : medication.nhsLink,
        trendLinks: Array.isArray(practiceCard.trend_links) ? practiceCard.trend_links : medication.trendLinks,
        sickDaysNeeded:
          typeof practiceCard.sick_days_needed === 'boolean'
            ? practiceCard.sick_days_needed
            : medication.sickDaysNeeded,
        reviewMonths:
          typeof practiceCard.review_months === 'number'
            ? practiceCard.review_months
            : medication.reviewMonths,
        contentReviewDate:
          typeof practiceCard.content_review_date === 'string'
            ? practiceCard.content_review_date
            : medication.contentReviewDate,
      };
    }

    return {
      code: medication.code,
      title: medication.title,
      description: medication.description,
      badge: medication.badge,
      category: medication.category,
      keyInfo: medication.keyInfo,
      nhsLink: medication.nhsLink,
      trendLinks: medication.trendLinks,
      sickDaysNeeded: medication.sickDaysNeeded,
      reviewMonths: medication.reviewMonths,
      contentReviewDate: medication.contentReviewDate,
    };
  };

  const openCustomEditor = (medication: MedicationRecord) => {
    const practiceCard = practiceCards[medication.code];
    const preview = buildMedicationPreview(medication, practiceCard);

    setDraftCode(medication.code);
    setDraft({
      code: medication.code,
      title: preview.title,
      description: preview.description,
      badge: preview.badge,
      category: preview.category,
      keyInfo: preview.keyInfo.length > 0 ? preview.keyInfo : [''],
      nhsLink: preview.nhsLink || '',
      trendLinks: preview.trendLinks.length > 0 ? preview.trendLinks : [{ ...EMPTY_TREND_LINK }],
      sickDaysNeeded: Boolean(preview.sickDaysNeeded),
      reviewMonths: preview.reviewMonths || 12,
      contentReviewDate: preview.contentReviewDate || '',
    });
    setSuccessMessage('');
  };

  const resetEditor = () => {
    setDraft(null);
    setDraftCode('');
  };

  const updateDraft = <K extends keyof CustomCardDraft>(key: K, value: CustomCardDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const updateKeyInfo = (index: number, value: string) => {
    setDraft((current) => {
      if (!current) return current;
      const next = [...current.keyInfo];
      next[index] = value;
      return { ...current, keyInfo: next };
    });
  };

  const addKeyInfo = () => {
    setDraft((current) => current ? { ...current, keyInfo: [...current.keyInfo, ''] } : current);
  };

  const removeKeyInfo = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      const next = current.keyInfo.filter((_, currentIndex) => currentIndex !== index);
      return { ...current, keyInfo: next.length > 0 ? next : [''] };
    });
  };

  const updateTrendLink = (index: number, field: 'title' | 'url', value: string) => {
    setDraft((current) => {
      if (!current) return current;
      const next = [...current.trendLinks];
      next[index] = { ...next[index], [field]: value };
      return { ...current, trendLinks: next };
    });
  };

  const addTrendLink = () => {
    setDraft((current) => current ? { ...current, trendLinks: [...current.trendLinks, { ...EMPTY_TREND_LINK }] } : current);
  };

  const removeTrendLink = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      const next = current.trendLinks.filter((_, currentIndex) => currentIndex !== index);
      return { ...current, trendLinks: next.length > 0 ? next : [{ ...EMPTY_TREND_LINK }] };
    });
  };

  const invokeAndReload = async (fn: () => Promise<void>, success: string) => {
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await fn();
      await loadPracticeCards(selectedPracticeId);
      await loadMemberships();
      setSuccessMessage(success);
    } catch (err) {
      console.error(err);
      setError(await getFunctionErrorMessage(err, 'Something went wrong.'));
    } finally {
      setSaving(false);
      setDisclaimerRequest(null);
      setConfirmDialog(null);
    }
  };

  const acceptGlobalCard = (medication: MedicationRecord, confirmLabel = 'Accept Global Template') => {
    if (!selectedPracticeId) return;

    setDisclaimerRequest({
      title: 'Accept Global Template',
      message: GLOBAL_TEMPLATE_DISCLAIMER_TEXT,
      checkboxLabel: 'I have reviewed this template and accept responsibility for deciding whether it is suitable for my practice.',
      confirmLabel,
      onConfirm: async () => {
        await invokeAndReload(async () => {
          const { error: invokeError } = await supabase.functions.invoke('accept-global-medication-card', {
            body: {
              practiceId: selectedPracticeId,
              code: medication.code,
              disclaimerAccepted: true,
            },
          });

          if (invokeError) {
            throw invokeError;
          }
        }, `${medication.code} is now using the global template.`);
      },
    });
  };

  const clearConfiguredCard = (medication: MedicationRecord) => {
    if (!selectedPracticeId) return;

    setConfirmDialog({
      title: 'Clear Practice Configuration',
      message: `Remove the configuration for ${medication.code}? Patients will see a placeholder for this medication until your practice accepts the global template or creates a custom version.`,
      confirmLabel: 'Clear Configuration',
      isDangerous: true,
      onConfirm: () => {
        void invokeAndReload(async () => {
          const { error: invokeError } = await supabase.functions.invoke('clear-practice-medication-card', {
            body: { practiceId: selectedPracticeId, code: medication.code },
          });

          if (invokeError) {
            throw invokeError;
          }
        }, `${medication.code} is now unconfigured for this practice.`);
      },
    });
  };

  const saveCustomDraft = () => {
    if (!selectedPracticeId || !draft) return;

    if (!draft.title.trim() || !draft.description.trim() || !draft.category.trim()) {
      setError('Title, description, and category are required for a practice version.');
      return;
    }

    setDisclaimerRequest({
      title: 'Save Practice Version',
      message: CUSTOM_CARD_DISCLAIMER_TEXT,
      checkboxLabel: 'I understand that my practice is responsible for this custom medication content.',
      confirmLabel: 'Save Practice Version',
      onConfirm: async () => {
        await invokeAndReload(async () => {
          const { error: invokeError } = await supabase.functions.invoke('save-practice-medication-card', {
            body: {
              practiceId: selectedPracticeId,
              code: draft.code,
              title: draft.title,
              description: draft.description,
              badge: draft.badge,
              category: draft.category,
              keyInfo: draft.keyInfo,
              nhsLink: draft.nhsLink,
              trendLinks: draft.trendLinks,
              sickDaysNeeded: draft.sickDaysNeeded,
              reviewMonths: draft.reviewMonths,
              contentReviewDate: draft.contentReviewDate,
              disclaimerAccepted: true,
            },
          });

          if (invokeError) {
            throw invokeError;
          }
        }, `${draft.code} is now using a practice-specific version.`);

        resetEditor();
      },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(resolvePath('/practice'));
  };

  if (loadingPortal || loadingMedications) {
    return (
      <div style={{ maxWidth: '820px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <FlaskConical size={48} color="#005eb8" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.25rem' }}>Loading your practice workspace...</h1>
        </div>
      </div>
    );
  }

  if (!selectedPractice) {
    return (
      <div style={{ maxWidth: '820px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center', borderLeft: '4px solid #d5281b' }}>
          <h1 style={{ fontSize: '1.25rem', color: '#d5281b' }}>Practice Access Error</h1>
          <p>{error || 'No practice is linked to this account. Contact your administrator.'}</p>
          <button onClick={handleSignOut} className="action-button" style={{ backgroundColor: '#d5281b' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      {previewMed && <MedicationPreviewModal med={previewMed} onClose={() => setPreviewMed(null)} />}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          isDangerous={confirmDialog.isDangerous}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {disclaimerRequest && (
        <DisclaimerDialog
          title={disclaimerRequest.title}
          message={disclaimerRequest.message}
          checkboxLabel={disclaimerRequest.checkboxLabel}
          confirmLabel={disclaimerRequest.confirmLabel}
          onCancel={() => setDisclaimerRequest(null)}
          onConfirm={() => void disclaimerRequest.onConfirm()}
        />
      )}

      <div className="dashboard-header">
        <div className="dashboard-header-copy">
          <h1>
            <FlaskConical size={28} color="#005eb8" /> {selectedPractice.name}
          </h1>
          <p>Review the shared medication library, accept global templates, and maintain practice-owned card versions.</p>
        </div>
        <div className="dashboard-actions">
          <button onClick={() => void loadPracticeCards(selectedPracticeId)} className="action-button" style={{ backgroundColor: '#4c6272' }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={handleSignOut} className="action-button" style={{ backgroundColor: '#d5281b' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {memberships.length > 1 && (
        <section className="dashboard-section">
          <div className="dashboard-panel" style={{ borderLeft: '4px solid #005eb8' }}>
            <div className="dashboard-panel-header">
              <div>
                <h2 className="dashboard-panel-title">Switch Editing Practice</h2>
                <p className="dashboard-panel-subtitle">
                  The selected practice below controls which drug cards, statistics, and disclaimers you are editing right now.
                </p>
              </div>
            </div>
            <div className="dashboard-field" style={{ maxWidth: '420px' }}>
              <label>Editing Practice</label>
              <select value={selectedPracticeId} onChange={(event) => setSelectedPracticeId(event.target.value)}>
                {memberships.map((membership) => (
                  <option key={membership.practice_id} value={membership.practice_id}>
                    {membership.practice.name}{membership.practice.is_active ? '' : ' (Inactive)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="dashboard-chip-row" style={{ marginTop: '0.75rem' }}>
              {memberships.map((membership) => (
                <span
                  key={`${membership.practice_id}-chip`}
                  className={`dashboard-chip${membership.practice_id === selectedPracticeId ? ' dashboard-chip--active' : ''}`}
                >
                  {membership.practice.name}
                  {membership.practice_id === selectedPracticeId || membership.is_default
                    ? ` (${[
                        membership.practice_id === selectedPracticeId ? 'Current' : null,
                        membership.is_default ? 'Default' : null,
                      ].filter(Boolean).join(', ')})`
                    : ''}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {!selectedPractice.is_active && (
        <div className="dashboard-banner dashboard-banner--info" style={{ marginBottom: '1rem' }}>
          This practice is currently inactive. You can still review and prepare medication cards, but patient links will not validate until the practice is activated by an administrator.
        </div>
      )}

      {error && (
        <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="dashboard-banner dashboard-banner--success" style={{ marginBottom: '1rem' }}>
          <CheckCircle size={18} /> {successMessage}
        </div>
      )}

      <section className="dashboard-section">
        <div className="dashboard-stat-grid">
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">Using Global Templates</div>
            <div className="dashboard-stat-value">{globalCount}</div>
            <p className="dashboard-stat-copy">Cards currently following the latest shared template.</p>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">Practice Versions</div>
            <div className="dashboard-stat-value">{customCount}</div>
            <p className="dashboard-stat-copy">Cards currently maintained by your practice.</p>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">Unconfigured Codes</div>
            <div className="dashboard-stat-value">{unconfiguredCount}</div>
            <p className="dashboard-stat-copy">Patients will see a placeholder for these medication codes.</p>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">Patient Link Uses</div>
            <div className="dashboard-stat-value">{selectedPractice.link_visit_count ?? 0}</div>
            <p className="dashboard-stat-copy">Successful patient link opens for this practice.</p>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">Last Patient Access</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212b32' }}>{lastAccessedLabel}</div>
            <p className="dashboard-stat-copy">Updated when patients open a valid link.</p>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">Patient Rating</div>
            <div className="dashboard-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {satisfactionLabel}
              {satisfactionLabel !== 'No ratings' && <Star size={22} fill="#fbc02d" color="#fbc02d" style={{ marginTop: '-2px' }} />}
            </div>
            <p className="dashboard-stat-copy">Average patient feedback score for this practice.</p>
          </div>
        </div>
      </section>

      {legacyReviewCodes.length > 0 && (
        <section className="dashboard-section">
          <div className="dashboard-panel" style={{ borderLeft: '4px solid #fa8c16' }}>
            <div className="dashboard-panel-header">
              <div>
                <h2 className="dashboard-panel-title">Previously Live Cards To Review</h2>
                <p className="dashboard-panel-subtitle">
                  These codes were previously selected in the legacy workflow. They are not active until your practice explicitly accepts the global template or saves a custom version.
                </p>
              </div>
            </div>
            <div className="dashboard-chip-row">
              {legacyReviewCodes.map((code) => (
                <span key={code} className="dashboard-chip dashboard-chip--active">
                  {code}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {draft && (
        <section className="dashboard-section">
          <div className="dashboard-panel" style={{ borderLeft: '4px solid #007f3b' }}>
            <div className="dashboard-panel-header">
              <div>
                <h2 className="dashboard-panel-title">Practice Version: {draft.code}</h2>
                <p className="dashboard-panel-subtitle">Save a practice-specific medication card for this code.</p>
              </div>
              <button onClick={resetEditor} className="dashboard-pill-button dashboard-pill-button--muted">
                Cancel
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="dashboard-field">
                <label>Title *</label>
                <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
              </div>

              <div className="dashboard-field">
                <label>Description *</label>
                <textarea
                  value={draft.description}
                  rows={4}
                  onChange={(event) => updateDraft('description', event.target.value)}
                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', resize: 'vertical' }}
                />
              </div>

              <div className="dashboard-form-grid">
                <div className="dashboard-field">
                  <label>Badge</label>
                  <select value={draft.badge} onChange={(event) => updateDraft('badge', event.target.value as CustomCardDraft['badge'])}>
                    <option value="NEW">New Medication</option>
                    <option value="REAUTH">Annual Review</option>
                    <option value="GENERAL">General Information</option>
                  </select>
                </div>
                <div className="dashboard-field">
                  <label>Category *</label>
                  <input value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} />
                </div>
                <div className="dashboard-field">
                  <label>Review Period (months)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={draft.reviewMonths}
                    onChange={(event) => updateDraft('reviewMonths', Math.max(1, parseInt(event.target.value, 10) || 12))}
                  />
                </div>
                <div className="dashboard-field">
                  <label>Content Review Date</label>
                  <input
                    type="date"
                    value={draft.contentReviewDate}
                    onChange={(event) => updateDraft('contentReviewDate', event.target.value)}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={draft.sickDaysNeeded}
                  onChange={(event) => updateDraft('sickDaysNeeded', event.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                Sick day rules apply
              </label>

              <div>
                <div className="dashboard-panel-header" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="dashboard-panel-title" style={{ fontSize: '1rem' }}>Key Information</h3>
                  <button onClick={addKeyInfo} className="dashboard-pill-button dashboard-pill-button--primary">
                    <Plus size={14} /> Add Point
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {draft.keyInfo.map((info, index) => (
                    <div key={`${draft.code}-key-${index}`} style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        value={info}
                        onChange={(event) => updateKeyInfo(index, event.target.value)}
                        placeholder={`Key point ${index + 1}`}
                        style={{ flex: 1, padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px' }}
                      />
                      <button onClick={() => removeKeyInfo(index)} className="dashboard-pill-button dashboard-pill-button--danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dashboard-field">
                <label>NHS Link</label>
                <input value={draft.nhsLink} onChange={(event) => updateDraft('nhsLink', event.target.value)} />
              </div>

              <div>
                <div className="dashboard-panel-header" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="dashboard-panel-title" style={{ fontSize: '1rem' }}>Linked Resources</h3>
                  <button onClick={addTrendLink} className="dashboard-pill-button dashboard-pill-button--primary">
                    <Plus size={14} /> Add Link
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {draft.trendLinks.map((link, index) => (
                    <div key={`${draft.code}-link-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '0.5rem' }}>
                      <input
                        value={link.title}
                        onChange={(event) => updateTrendLink(index, 'title', event.target.value)}
                        placeholder="Link title"
                        style={{ padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px' }}
                      />
                      <input
                        value={link.url}
                        onChange={(event) => updateTrendLink(index, 'url', event.target.value)}
                        placeholder="https://..."
                        style={{ padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px' }}
                      />
                      <button onClick={() => removeTrendLink(index)} className="dashboard-pill-button dashboard-pill-button--danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="dashboard-inline-actions" style={{ marginTop: '1.25rem' }}>
              <button
                onClick={() => {
                  const baseMedication = allMedications.find((medication) => medication.code === draftCode);
                  if (!baseMedication) return;

                  setPreviewMed(buildMedicationPreview(baseMedication, {
                    practice_id: selectedPracticeId,
                    code: draft.code,
                    source_type: 'custom',
                    title: draft.title,
                    description: draft.description,
                    badge: draft.badge,
                    category: draft.category,
                    key_info: draft.keyInfo,
                    nhs_link: draft.nhsLink,
                    trend_links: draft.trendLinks,
                    sick_days_needed: draft.sickDaysNeeded,
                    review_months: draft.reviewMonths,
                    content_review_date: draft.contentReviewDate,
                    disclaimer_version: '',
                  }));
                }}
                className="action-button"
                style={{ backgroundColor: '#005eb8' }}
              >
                <Eye size={16} /> Preview Practice Version
              </button>
              <button onClick={saveCustomDraft} disabled={saving} className="action-button" style={{ backgroundColor: '#007f3b', opacity: saving ? 0.7 : 1 }}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Practice Version'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <div className="dashboard-panel">
          <div className="dashboard-toolbar">
            <div>
              <h2 className="dashboard-panel-title">Medication Library</h2>
              <p className="dashboard-panel-subtitle">
                Each code can be left unconfigured, linked to the shared global template, or maintained as a practice-owned version.
              </p>
            </div>
            <div className="dashboard-search">
              <input
                type="text"
                value={librarySearch}
                onChange={(event) => setLibrarySearch(event.target.value)}
                placeholder="Search by code, title, category, or description"
                style={{ width: '100%', padding: '0.75rem 0.9rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem' }}
              />
            </div>
          </div>

          {loadingCards ? (
            <p style={{ color: '#4c6272' }}>Loading medication configuration...</p>
          ) : (
            <div className="dashboard-list">
              {filteredMedications.map((medication) => {
                const practiceCard = practiceCards[medication.code];
                const state: 'global' | 'custom' | 'unconfigured' = practiceCard?.source_type ?? 'unconfigured';
                const previewMedication = buildMedicationPreview(medication, practiceCard);

                return (
                  <div key={medication.code} className="dashboard-list-card">
                    <div style={{ color: '#005eb8', flexShrink: 0 }}>{getMedicationIcon(medication.code)}</div>
                    <div className="dashboard-list-main">
                      <div className="dashboard-list-title">{medication.title}</div>
                      <div className="dashboard-meta">
                        <span className="dashboard-badge dashboard-badge--blue">{medication.code}</span>
                        <span className={`dashboard-badge ${medication.badge === 'NEW' ? 'dashboard-badge--blue' : medication.badge === 'REAUTH' ? 'dashboard-badge--green' : 'dashboard-badge--muted'}`}>
                          {medication.badge}
                        </span>
                        <span className="dashboard-badge dashboard-badge--amber">{medication.category}</span>
                        <span className={`dashboard-badge ${
                          state === 'custom'
                            ? 'dashboard-badge--green'
                            : state === 'global'
                              ? 'dashboard-badge--blue'
                              : 'dashboard-badge--muted'
                        }`}>
                          {state === 'custom' ? 'USING PRACTICE VERSION' : state === 'global' ? 'USING GLOBAL TEMPLATE' : 'NOT CONFIGURED'}
                        </span>
                      </div>
                      <p className="dashboard-list-copy" style={{ marginTop: '0.5rem' }}>
                        {state === 'custom'
                          ? 'Patients will see your practice-specific version for this medication.'
                          : state === 'global'
                            ? 'Patients will see the current global template for this medication.'
                            : 'Patients will see a placeholder until your practice accepts the global template or saves a practice version.'}
                      </p>
                    </div>
                    <div className="dashboard-list-actions">
                      <button onClick={() => setPreviewMed(previewMedication)} className="dashboard-pill-button">
                        <Eye size={14} /> {state === 'custom' ? 'Preview Practice' : 'Preview Global'}
                      </button>

                      {state !== 'custom' && (
                        <button onClick={() => acceptGlobalCard(medication, state === 'global' ? 'Use Global Template' : 'Accept Global Template')} className="dashboard-pill-button dashboard-pill-button--primary">
                          <CheckCircle size={14} /> {state === 'global' ? 'Use Global Instead' : 'Accept Global'}
                        </button>
                      )}

                      <button onClick={() => openCustomEditor(medication)} className="dashboard-pill-button dashboard-pill-button--success">
                        {state === 'custom' ? <><Edit2 size={14} /> Edit Practice Version</> : <><Plus size={14} /> Create Practice Version</>}
                      </button>

                      {practiceCard && (
                        <button onClick={() => clearConfiguredCard(medication)} className="dashboard-pill-button dashboard-pill-button--danger">
                          <Trash2 size={14} /> Clear Configuration
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default PracticeDashboard;
