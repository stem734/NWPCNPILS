import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Trash2, Save, Copy, CheckCircle, ExternalLink, Link, AlertCircle, Eye, Edit2, CopyPlus } from 'lucide-react';
import MedicationPreviewModal from '../components/MedicationPreviewModal';
import { resolvePath } from '../subdomainUtils';
import ConfirmDialog from '../components/ConfirmDialog';
import { type MedicationRecord, useMedicationCatalog } from '../medicationCatalog';
import { getFunctionErrorMessage } from '../supabaseFunctionError';
import { HEALTH_CHECK_CARD_LABELS, HEALTH_CHECK_CODE_VALUES, type HealthCheckCodeFamily } from '../healthCheckCodes';

interface TrendLink {
  title: string;
  url: string;
}

type OutputBuilderType = 'medication' | 'healthcheck' | 'screening' | 'immunisation';

const HEALTH_CHECK_PARAM_KEYS: Record<HealthCheckCodeFamily, string> = {
  bp: 'bps',
  bmi: 'bmis',
  cvd: 'cvds',
  chol: 'ldls',
  hba1c: 'hba1cs',
  act: 'acts',
  alc: 'alcs',
  smk: 'smks',
};

const SCREENING_OPTIONS = [
  { value: 'cervical', label: 'Cervical screening' },
  { value: 'bowel', label: 'Bowel screening' },
  { value: 'breast', label: 'Breast screening' },
  { value: 'aaa', label: 'AAA screening' },
  { value: 'diabetic_eye', label: 'Diabetic eye screening' },
];

const IMMUNISATION_OPTIONS = [
  { value: 'flu', label: 'Flu' },
  { value: 'covid', label: 'COVID-19' },
  { value: 'shingles', label: 'Shingles' },
  { value: 'pneumo', label: 'Pneumococcal' },
  { value: 'pertussis', label: 'Pertussis' },
  { value: 'mmr', label: 'MMR' },
  { value: 'hpv', label: 'HPV' },
];

const DrugBuilder: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();
  const [selectedOutputType, setSelectedOutputType] = useState<OutputBuilderType>('medication');
  const {
    medications: existingMeds,
    loading: loadingMeds,
    reload: reloadMeds,
  } = useMedicationCatalog();

  // Search / generate
  const [medName, setMedName] = useState('');
  const [medType, setMedType] = useState<'NEW' | 'REAUTH'>('NEW');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Editable fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState<'NEW' | 'REAUTH'>('NEW');
  const [category, setCategory] = useState('');
  const [keyInfo, setKeyInfo] = useState<string[]>(['']);
  const [nhsLink, setNhsLink] = useState('');
  const [trendLinks, setTrendLinks] = useState<TrendLink[]>([]);
  const [sickDaysNeeded, setSickDaysNeeded] = useState(false);
  const [reviewMonths, setReviewMonths] = useState(12);
  const [contentReviewDate, setContentReviewDate] = useState('');
  const [hasContent, setHasContent] = useState(false);
  const [editingCode, setEditingCode] = useState('');
  const [requestedCode, setRequestedCode] = useState('');
  const [previewMed, setPreviewMed] = useState<MedicationRecord | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedCode, setSavedCode] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedAction, setSavedAction] = useState<'created' | 'updated'>('created');

  const [deletingCode, setDeletingCode] = useState('');
  const [builderOrgName, setBuilderOrgName] = useState('');
  const [healthCheckResultDate, setHealthCheckResultDate] = useState('');
  const [healthCheckSelections, setHealthCheckSelections] = useState<Record<HealthCheckCodeFamily, string>>({
    bp: '',
    bmi: '',
    cvd: '',
    chol: '',
    hba1c: '',
    act: '',
    alc: '',
    smk: '',
  });
  const [screeningType, setScreeningType] = useState('cervical');
  const [immunisationSelections, setImmunisationSelections] = useState<string[]>(['flu']);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDangerous: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthenticated(true);
      } else {
        navigate(resolvePath('/admin'));
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const previewDraft = useMemo<MedicationRecord | null>(() => {
    if (!hasContent) {
      return null;
    }

    return {
      code: editingCode || '000',
      title: title.trim() || medName.trim() || 'Medication Preview',
      description: description.trim(),
      badge,
      category: category.trim(),
      keyInfo: keyInfo.filter((item) => item.trim()),
      nhsLink: nhsLink.trim(),
      trendLinks: trendLinks.filter((item) => item.title.trim() && item.url.trim()),
      sickDaysNeeded,
      reviewMonths,
      contentReviewDate,
      source: editingCode ? 'override' : 'custom',
      isBuiltIn: false,
    };
  }, [badge, category, description, editingCode, hasContent, keyInfo, medName, nhsLink, reviewMonths, contentReviewDate, sickDaysNeeded, title, trendLinks]);

  const getFriendlyMedicationName = (medication: MedicationRecord) => {
    const [baseTitle] = medication.title.split(' - ');
    return baseTitle.trim();
  };

  const startEditingMedication = (medication: MedicationRecord) => {
    setMedName(getFriendlyMedicationName(medication));
    setMedType(medication.badge === 'REAUTH' ? 'REAUTH' : 'NEW');
    setTitle(medication.title);
    setDescription(medication.description);
    setBadge(medication.badge === 'REAUTH' ? 'REAUTH' : 'NEW');
    setCategory(medication.category);
    setKeyInfo(medication.keyInfo.length > 0 ? medication.keyInfo : ['']);
    setNhsLink(medication.nhsLink || '');
    setTrendLinks(medication.trendLinks);
    setSickDaysNeeded(Boolean(medication.sickDaysNeeded));
    setReviewMonths(medication.reviewMonths || 12);
    setContentReviewDate(medication.contentReviewDate || '');
    setEditingCode(medication.code);
    setRequestedCode(medication.code);
    setHasContent(true);
    setSavedCode('');
    setSavedAction('updated');
    setSaveError('');
    setGenError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicateMedication = (medication: MedicationRecord) => {
    const friendlyName = getFriendlyMedicationName(medication);
    const duplicateTitle = medication.title.includes(' - ')
      ? medication.title.replace(friendlyName, `${friendlyName} Copy`)
      : `${medication.title} Copy`;

    setMedName(`${friendlyName} Copy`);
    setMedType(medication.badge === 'REAUTH' ? 'REAUTH' : 'NEW');
    setTitle(duplicateTitle);
    setDescription(medication.description);
    setBadge(medication.badge === 'REAUTH' ? 'REAUTH' : 'NEW');
    setCategory(medication.category);
    setKeyInfo(medication.keyInfo.length > 0 ? medication.keyInfo : ['']);
    setNhsLink(medication.nhsLink || '');
    setTrendLinks(medication.trendLinks);
    setSickDaysNeeded(Boolean(medication.sickDaysNeeded));
    setReviewMonths(medication.reviewMonths || 12);
    setContentReviewDate(medication.contentReviewDate || '');
    setEditingCode('');
    setRequestedCode('');
    setHasContent(true);
    setSavedCode('');
    setSavedAction('created');
    setSaveError('');
    setGenError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sourceLabel = (medication: MedicationRecord) => {
    if (medication.source === 'built-in') return 'Built in';
    if (medication.source === 'override') return 'Built-in override';
    return 'Custom';
  };

  const buildPatientUrl = (params: URLSearchParams) =>
    `${window.location.origin}${resolvePath('/patient')}?${params.toString()}`;

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const healthCheckPreviewUrl = useMemo(() => {
    const params = new URLSearchParams({ type: 'healthcheck' });
    if (builderOrgName.trim()) {
      params.set('org', builderOrgName.trim());
    }
    if (healthCheckResultDate) {
      params.set('date', healthCheckResultDate);
    }
    (Object.entries(healthCheckSelections) as Array<[HealthCheckCodeFamily, string]>).forEach(([family, code]) => {
      if (!code) return;
      params.set(HEALTH_CHECK_PARAM_KEYS[family], code);
    });
    return buildPatientUrl(params);
  }, [builderOrgName, healthCheckResultDate, healthCheckSelections]);

  const screeningPreviewUrl = useMemo(() => {
    const params = new URLSearchParams({ type: 'screening', screen: screeningType });
    if (builderOrgName.trim()) {
      params.set('org', builderOrgName.trim());
    }
    return buildPatientUrl(params);
  }, [builderOrgName, screeningType]);

  const immunisationPreviewUrl = useMemo(() => {
    const params = new URLSearchParams({ type: 'imms' });
    if (builderOrgName.trim()) {
      params.set('org', builderOrgName.trim());
    }
    if (immunisationSelections.length > 0) {
      params.set('vaccine', immunisationSelections.join(','));
    }
    return buildPatientUrl(params);
  }, [builderOrgName, immunisationSelections]);

  const updateHealthCheckSelection = (family: HealthCheckCodeFamily, code: string) => {
    setHealthCheckSelections((current) => ({ ...current, [family]: code }));
  };

  const toggleImmunisation = (value: string) => {
    setImmunisationSelections((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handleGenerate = async () => {
    if (!medName.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-medication-content', {
        body: { medicationName: medName.trim(), type: medType },
      });
      if (invokeError) throw invokeError;

      if (data.success && data.content) {
        const c = data.content;
        setTitle((c.title as string) || medName);
        setDescription((c.description as string) || '');
        setBadge(medType);
        setCategory((c.category as string) || '');
        setKeyInfo((c.keyInfo as string[]) || ['']);
        setNhsLink((c.nhsLink as string) || '');
        setSickDaysNeeded((c.sickDaysNeeded as boolean) || false);
        setReviewMonths((c.reviewMonths as number) || 12);
        
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + 12);
        setContentReviewDate(targetDate.toISOString().slice(0, 10));

        setTrendLinks((c.trendLinks as TrendLink[]) || []);
        setHasContent(true);
        setSavedCode('');
        setRequestedCode('');
      }
    } catch (err) {
      console.error('Generation error:', err);
      const message = await getFunctionErrorMessage(err, 'AI generation failed.');
      setGenError(message);
      // Still show the editor so they can fill manually
      setTitle(medName);
      setBadge(medType);
      setKeyInfo(['']);
      setHasContent(true);
      setRequestedCode('');
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim() || !category.trim()) {
      setSaveError('Title, description, and category are required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('save-medication', {
        body: {
          code: editingCode || undefined,
          requestedCode: requestedCode.trim() || undefined,
          medicationName: medName.trim() || title.trim(),
          title: title.trim(),
          description: description.trim(),
          badge,
          category: category.trim(),
          keyInfo: keyInfo.filter(k => k.trim()),
          nhsLink: nhsLink.trim(),
          trendLinks: trendLinks.filter(l => l.title.trim() && l.url.trim()),
          sickDaysNeeded,
          reviewMonths,
          contentReviewDate,
        },
      });
      if (invokeError) throw invokeError;
      if (data.success) {
        setSavedAction(editingCode ? 'updated' : 'created');
        setSavedCode(data.code);
        await reloadMeds();
      }
    } catch (err) {
      console.error('Save error:', err);
      const message = await getFunctionErrorMessage(err, 'Failed to save medication. Please try again.');
      setSaveError(message);
    }
    setSaving(false);
  };

  const handleDelete = (medication: MedicationRecord) => {
    const isBuiltIn = medication.isBuiltIn;
    const deleteTitle = isBuiltIn ? 'Hide Medication?' : 'Delete Medication?';
    const deleteMessage = isBuiltIn
      ? `Hide medication ${medication.code}? It will be removed from the app until you restore it in the database.`
      : `Delete medication ${medication.code}? This cannot be undone from the builder.`;

    setConfirmDialog({
      title: deleteTitle,
      message: deleteMessage,
      confirmLabel: isBuiltIn ? 'Hide' : 'Delete',
      isDangerous: true,
      onConfirm: async () => {
        setDeletingCode(medication.code);
        try {
          const { error: delError } = await supabase.functions.invoke('delete-medication', {
            body: { code: medication.code },
          });
          if (delError) throw delError;
          await reloadMeds();
          if (editingCode === medication.code) {
            resetForm();
          }
        } catch {
          console.error('Delete error');
        }
        setDeletingCode('');
        setConfirmDialog(null);
      },
    });
  };

  const updateKeyInfo = (index: number, value: string) => {
    const updated = [...keyInfo];
    updated[index] = value;
    setKeyInfo(updated);
  };

  const addKeyInfo = () => setKeyInfo([...keyInfo, '']);
  const removeKeyInfo = (index: number) => setKeyInfo(keyInfo.filter((_, i) => i !== index));

  const updateTrendLink = (index: number, field: 'title' | 'url', value: string) => {
    const updated = [...trendLinks];
    updated[index] = { ...updated[index], [field]: value };
    setTrendLinks(updated);
  };

  const addTrendLink = () => setTrendLinks([...trendLinks, { title: '', url: '' }]);
  const removeTrendLink = (index: number) => setTrendLinks(trendLinks.filter((_, i) => i !== index));

  const resetForm = () => {
    setMedName('');
    setMedType('NEW');
    setTitle('');
    setDescription('');
    setBadge('NEW');
    setCategory('');
    setKeyInfo(['']);
    setNhsLink('');
    setTrendLinks([]);
    setSickDaysNeeded(false);
    setReviewMonths(12);
    setContentReviewDate('');
    setHasContent(false);
    setEditingCode('');
    setRequestedCode('');
    setSavedCode('');
    setSavedAction('created');
    setSaveError('');
    setGenError('');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  if (!authenticated) return null;

  // Success screen after saving
  if (savedCode) {
    return (
      <>
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
      <div className="dashboard-shell" style={{ maxWidth: '700px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <CheckCircle size={64} color="#007f3b" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', color: '#007f3b' }}>
            Output {savedAction === 'created' ? 'Created' : 'Updated'}
          </h1>
          <p style={{ color: '#4c6272', marginBottom: '1.5rem' }}>
            <strong>{title}</strong> has been {savedAction === 'created' ? 'created' : 'updated'} successfully.
          </p>

          <div style={{
            padding: '1.5rem', background: '#eef7ff', borderRadius: '12px',
            border: '2px solid #005eb8', marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '0.85rem', color: '#4c6272', marginBottom: '0.5rem' }}>Medication Output Code</div>
            <div style={{
              fontSize: '3rem', fontWeight: 800, color: '#005eb8',
              fontFamily: 'monospace', letterSpacing: '0.1em',
            }}>
              {savedCode}
            </div>
            <button
              onClick={() => copyCode(savedCode)}
              className="action-button"
              style={{ marginTop: '1rem', backgroundColor: '#005eb8' }}
            >
              <Copy size={16} /> Copy Code
            </button>
          </div>

          <div style={{
            padding: '1rem', background: '#fff9c4', borderRadius: '8px',
            fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'left',
          }}>
            <strong>Add to SystmOne Protocol:</strong>
            <br />
            Add code <strong>{savedCode}</strong> to your medication protocol output.
            When included in the URL as <code>codes=...{savedCode}</code>, patients will see this medication information.
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={resetForm} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Plus size={16} /> Create Another
            </button>
            <button onClick={() => navigate(resolvePath('/admin/dashboard'))} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
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
    <div className="dashboard-shell">
      {previewMed && <MedicationPreviewModal med={previewMed} onClose={() => setPreviewMed(null)} />}

      <div className="dashboard-header">
        <div className="dashboard-header-copy" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <button
          onClick={() => navigate(resolvePath('/admin/dashboard'))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#005eb8', display: 'flex' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Output Builder</h1>
          <p style={{ margin: '0.25rem 0 0' }}>
            Manage the patient-facing outputs delivered through MyMedInfo, including medication information and health-check journeys.
          </p>
        </div>
      </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #4c6272' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Output Types</h2>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div style={{ padding: '0.9rem', border: '1px solid #d8dde0', borderRadius: '10px', background: '#f8fbfd' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#005eb8' }}>Medication Info</div>
            <div style={{ fontSize: '0.9rem', color: '#4c6272' }}>Created and maintained in this builder using reusable SystmOne codes.</div>
          </div>
          <div style={{ padding: '0.9rem', border: '1px solid #d8dde0', borderRadius: '10px', background: '#f8fbfd' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#005eb8' }}>Health Checks</div>
            <div style={{ fontSize: '0.9rem', color: '#4c6272' }}>Delivered through structured health-check parameters and rendered in the patient pathway.</div>
          </div>
          <div style={{ padding: '0.9rem', border: '1px solid #d8dde0', borderRadius: '10px', background: '#f8fbfd' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#005eb8' }}>Screening</div>
            <div style={{ fontSize: '0.9rem', color: '#4c6272' }}>Supports screening information views routed from the same patient entry point.</div>
          </div>
          <div style={{ padding: '0.9rem', border: '1px solid #d8dde0', borderRadius: '10px', background: '#f8fbfd' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#005eb8' }}>Immunisation</div>
            <div style={{ fontSize: '0.9rem', color: '#4c6272' }}>Supports vaccine and immunisation information alongside the wider output framework.</div>
          </div>
        </div>
        <p style={{ margin: '1rem 0 0', color: '#4c6272', fontSize: '0.95rem' }}>
          This editor currently manages the medication content library. Other output types are already supported by the patient router and can be expanded here as the admin tooling grows.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Builder Mode</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {([
            ['medication', 'Medication'],
            ['healthcheck', 'Health Checks'],
            ['screening', 'Screening'],
            ['immunisation', 'Immunisation'],
          ] as Array<[OutputBuilderType, string]>).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSelectedOutputType(value)}
              className="action-button"
              style={{
                backgroundColor: selectedOutputType === value ? '#005eb8' : '#eef7ff',
                color: selectedOutputType === value ? '#ffffff' : '#005eb8',
                border: selectedOutputType === value ? 'none' : '1px solid #005eb8',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 1: Search and Generate */}
      {selectedOutputType === 'medication' && (
      <>
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
          1. {editingCode ? `Editing Medication Output ${editingCode}` : 'Medication Output'}
        </h2>
        <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
          Create or update medication outputs here. Health checks and other patient pathways use the same platform, but their content is currently configured through dedicated route parameters and views.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={medName}
            onChange={e => setMedName(e.target.value)}
                placeholder="Enter medication name (e.g. Metformin, Atorvastatin)"
            style={{
              flex: '1 1 200px', padding: '0.75rem', border: '2px solid #d8dde0',
              borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box',
            }}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          />
          <select
            value={medType}
            onChange={e => setMedType(e.target.value as 'NEW' | 'REAUTH')}
            style={{
              flex: '1 1 120px', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px',
              fontSize: '0.95rem', background: 'white',
            }}
          >
            <option value="NEW">New Prescription</option>
            <option value="REAUTH">Reauthorisation</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating || !medName.trim()}
            className="action-button"
            style={{ flex: '1 1 auto', backgroundColor: '#005eb8', opacity: generating || !medName.trim() ? 0.6 : 1, justifyContent: 'center' }}
          >
            <Sparkles size={16} /> {generating ? 'Generating...' : 'Generate with AI'}
          </button>
        </div>
        {genError && (
          <div style={{ padding: '0.5rem 0.75rem', background: '#fff9c4', color: '#7a6200', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> {genError}
          </div>
        )}
      </div>

      {/* Step 2: Editor */}
      {hasContent && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #007f3b' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
            2. {editingCode ? `Edit Medication Output ${editingCode}` : 'Edit Medication Content'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Title *</label>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Description *</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)} rows={3}
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Category *</label>
                <input
                  type="text" value={category} onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Diabetes, Cardiovascular"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Type</label>
                <select
                  value={badge} onChange={e => setBadge(e.target.value as 'NEW' | 'REAUTH')}
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', background: 'white' }}
                >
                  <option value="NEW">New Medication</option>
                  <option value="REAUTH">Reauthorisation</option>
                </select>
              </div>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Code</label>
                <input
                  type="text"
                  value={requestedCode}
                  onChange={e => setRequestedCode(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                  placeholder={badge === 'REAUTH' ? 'e.g. 602' : 'e.g. 601'}
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Review Period (months)</label>
                <input
                  type="number"
                  value={reviewMonths}
                  onChange={e => setReviewMonths(Math.max(1, parseInt(e.target.value) || 12))}
                  min="1"
                  max="60"
                  placeholder="e.g. 12"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Content Review Date</label>
                <input
                  type="date"
                  value={contentReviewDate}
                  onChange={e => setContentReviewDate(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'end', paddingBottom: '0.2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                  <input
                    type="checkbox" checked={sickDaysNeeded} onChange={e => setSickDaysNeeded(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  Sick Day Rules
                </label>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#4c6272', margin: '-0.25rem 0 0' }}>
              Leave the code blank to auto-pair with an existing family where possible, for example `601` and `602`. Enter a code manually if you need to override it.
            </p>

            {/* Key Information */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Key Information Points</label>
                <button onClick={addKeyInfo} style={{ background: 'none', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Plus size={14} /> Add Point
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {keyInfo.map((info, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text" value={info} onChange={e => updateKeyInfo(i, e.target.value)}
                      placeholder={`Key point ${i + 1}`}
                      style={{ flex: 1, padding: '0.5rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    {keyInfo.length > 1 && (
                      <button onClick={() => removeKeyInfo(i)} style={{ background: '#fde8e8', border: 'none', color: '#d5281b', borderRadius: '6px', padding: '0.5rem', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* NHS Link */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><ExternalLink size={14} /> NHS Link</span>
              </label>
              <input
                type="url" value={nhsLink} onChange={e => setNhsLink(e.target.value)}
                placeholder="https://www.nhs.uk/medicines/..."
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* Resource Links */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Link size={14} /> Resource Links (leaflets, PDFs)
                </label>
                <button onClick={addTrendLink} style={{ background: 'none', border: '1px solid #007f3b', color: '#007f3b', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Plus size={14} /> Add Link
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {trendLinks.map((link, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text" value={link.title} onChange={e => updateTrendLink(i, 'title', e.target.value)}
                      placeholder="Link title"
                      style={{ flex: 1, padding: '0.5rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <input
                      type="url" value={link.url} onChange={e => updateTrendLink(i, 'url', e.target.value)}
                      placeholder="https://... (direct PDF link)"
                      style={{ flex: 2, padding: '0.5rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => removeTrendLink(i)} style={{ background: '#fde8e8', border: 'none', color: '#d5281b', borderRadius: '6px', padding: '0.5rem', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {trendLinks.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#4c6272', margin: 0 }}>No resource links added yet. Click "Add Link" to add PDF leaflets or external resources.</p>
                )}
              </div>
            </div>
          </div>

          {saveError && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '6px', marginTop: '1rem', fontSize: '0.85rem' }}>
              {saveError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => previewDraft && setPreviewMed(previewDraft)}
              disabled={!previewDraft || !previewDraft.description || previewDraft.keyInfo.length === 0}
              className="action-button"
              style={{ flex: '1 1 auto', justifyContent: 'center', backgroundColor: '#005eb8', opacity: !previewDraft || !previewDraft.description || previewDraft.keyInfo.length === 0 ? 0.6 : 1 }}
            >
              <Eye size={16} /> Preview
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="action-button"
              style={{ flex: '1 1 auto', justifyContent: 'center', backgroundColor: '#007f3b', opacity: saving ? 0.6 : 1 }}
            >
              <Save size={16} /> {saving ? 'Saving...' : editingCode ? 'Save Changes' : 'Save'}
            </button>
            <button onClick={resetForm} className="action-button" style={{ flex: '1 1 auto', justifyContent: 'center', backgroundColor: '#4c6272' }}>
              {editingCode ? 'Cancel Edit' : 'Reset'}
            </button>
          </div>
        </div>
      )}

      {/* Existing medications */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>3. Medication Catalogue</h2>
        {loadingMeds ? (
          <p style={{ color: '#4c6272' }}>Loading...</p>
        ) : existingMeds.length === 0 ? (
          <p style={{ color: '#4c6272' }}>No medications available. Use the search above to create your first one.</p>
        ) : (
          <div className="dashboard-list">
            {existingMeds.map(med => (
              <div
                key={med.code}
                className="dashboard-list-card"
              >
                <div style={{
                  padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem',
                  fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white',
                  minWidth: '40px', textAlign: 'center',
                }}>
                  {med.code}
                </div>
                <div className="dashboard-list-main">
                  <div className="dashboard-list-title">{med.title}</div>
                  <div className="dashboard-meta" style={{ marginTop: '0.15rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#4c6272' }}>{med.category}</span>
                    <span style={{
                      padding: '0 0.4rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700,
                      background: med.badge === 'NEW' ? '#005eb8' : med.badge === 'REAUTH' ? '#007f3b' : '#4c6272',
                      color: 'white',
                    }}>
                      {med.badge}
                    </span>
                    <span className={`dashboard-badge ${med.source === 'custom' ? 'dashboard-badge--amber' : med.source === 'override' ? 'dashboard-badge--purple' : 'dashboard-badge--muted'}`}>
                      {sourceLabel(med)}
                    </span>
                    <span className="dashboard-badge dashboard-badge--blue">
                      Review: {med.reviewMonths || 12}mo
                    </span>
                    <span className={`dashboard-badge ${
                      !med.contentReviewDate ? 'dashboard-badge--muted' :
                      new Date(`${med.contentReviewDate}T00:00:00`).getTime() < Date.now() ? 'dashboard-badge--red' :
                      new Date(`${med.contentReviewDate}T00:00:00`).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000 ? 'dashboard-badge--amber' :
                      'dashboard-badge--green'
                    }`}>
                      {med.contentReviewDate ? `Content review: ${med.contentReviewDate}` : 'No review set'}
                    </span>
                  </div>
                </div>
                <div className="dashboard-list-actions">
                  <button
                    onClick={() => setPreviewMed(med)}
                    title="Preview patient view"
                    className="action-button-sm"
                    style={{
                      background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8',
                      borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      justifyContent: 'center'
                    }}
                  >
                    <Eye size={14} /> Preview
                  </button>
                  <button
                    onClick={() => startEditingMedication(med)}
                    title="Edit medication"
                    className="action-button-sm"
                    style={{
                      background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272',
                      borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      justifyContent: 'center'
                    }}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    onClick={() => duplicateMedication(med)}
                    title="Duplicate medication"
                    className="action-button-sm"
                    style={{
                      background: '#f3f8f1', border: '1px solid #007f3b', color: '#007f3b',
                      borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      justifyContent: 'center'
                    }}
                  >
                    <CopyPlus size={14} /> Duplicate
                  </button>
                  <button
                    onClick={() => copyCode(med.code)}
                    title="Copy SystmOne code"
                    className="action-button-sm"
                    style={{
                      background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8',
                      borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      justifyContent: 'center'
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                  <button
                    onClick={() => handleDelete(med)}
                    disabled={deletingCode === med.code}
                    className="action-button-sm"
                    style={{
                      background: '#fde8e8', border: 'none', color: '#d5281b',
                      borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {selectedOutputType === 'healthcheck' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Health Check Output Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
            Build a live patient preview link for NHS Health Check outputs using the same route format supported by the patient router.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Practice name</label>
              <input
                type="text"
                value={builderOrgName}
                onChange={(e) => setBuilderOrgName(e.target.value)}
                placeholder="e.g. Nottingham West GP Practices"
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Result date</label>
              <input
                type="date"
                value={healthCheckResultDate}
                onChange={(e) => setHealthCheckResultDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1rem' }}>
            {(Object.keys(HEALTH_CHECK_CARD_LABELS) as HealthCheckCodeFamily[]).map((family) => (
              <div key={family}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{HEALTH_CHECK_CARD_LABELS[family]}</label>
                <select
                  value={healthCheckSelections[family]}
                  onChange={(e) => updateHealthCheckSelection(family, e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', background: '#ffffff' }}
                >
                  <option value="">Not included</option>
                  {HEALTH_CHECK_CODE_VALUES[family].map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ padding: '1rem', background: '#f8fbfd', borderRadius: '10px', border: '1px solid #d8dde0', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#005eb8' }}>Preview Link</div>
            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1d2a33' }}>{healthCheckPreviewUrl}</code>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => copyText(healthCheckPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Copy size={16} /> Copy Preview Link
            </button>
            <a href={healthCheckPreviewUrl} target="_blank" rel="noreferrer" className="action-button" style={{ backgroundColor: '#007f3b', textDecoration: 'none' }}>
              <ExternalLink size={16} /> Open Preview
            </a>
          </div>
        </div>
      )}

      {selectedOutputType === 'screening' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Screening Output Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
            Create a screening route link for practice comms and test the patient view before you use it in a live protocol.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Practice name</label>
              <input
                type="text"
                value={builderOrgName}
                onChange={(e) => setBuilderOrgName(e.target.value)}
                placeholder="e.g. Nottingham West GP Practices"
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Screening type</label>
              <select
                value={screeningType}
                onChange={(e) => setScreeningType(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', background: '#ffffff' }}
              >
                {SCREENING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fbfd', borderRadius: '10px', border: '1px solid #d8dde0', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#005eb8' }}>Preview Link</div>
            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1d2a33' }}>{screeningPreviewUrl}</code>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => copyText(screeningPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Copy size={16} /> Copy Preview Link
            </button>
            <a href={screeningPreviewUrl} target="_blank" rel="noreferrer" className="action-button" style={{ backgroundColor: '#007f3b', textDecoration: 'none' }}>
              <ExternalLink size={16} /> Open Preview
            </a>
          </div>
        </div>
      )}

      {selectedOutputType === 'immunisation' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Immunisation Output Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
            Build immunisation links for single or multiple vaccines and open the patient view directly from the builder.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Practice name</label>
            <input
              type="text"
              value={builderOrgName}
              onChange={(e) => setBuilderOrgName(e.target.value)}
              placeholder="e.g. Nottingham West GP Practices"
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Vaccines</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {IMMUNISATION_OPTIONS.map((option) => (
                <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 0.8rem', border: '1px solid #d8dde0', borderRadius: '8px', background: '#f8fbfd' }}>
                  <input
                    type="checkbox"
                    checked={immunisationSelections.includes(option.value)}
                    onChange={() => toggleImmunisation(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fbfd', borderRadius: '10px', border: '1px solid #d8dde0', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#005eb8' }}>Preview Link</div>
            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1d2a33' }}>{immunisationPreviewUrl}</code>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => copyText(immunisationPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Copy size={16} /> Copy Preview Link
            </button>
            <a href={immunisationPreviewUrl} target="_blank" rel="noreferrer" className="action-button" style={{ backgroundColor: '#007f3b', textDecoration: 'none' }}>
              <ExternalLink size={16} /> Open Preview
            </a>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default DrugBuilder;
