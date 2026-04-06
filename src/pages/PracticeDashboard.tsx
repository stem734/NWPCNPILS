import React, { useState, useEffect, useMemo } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { LogOut, FlaskConical, CheckCircle, Save, CheckSquare, Square, Eye } from 'lucide-react';
import type { MedContent } from '../medicationData';
import MedicationPreviewModal from '../components/MedicationPreviewModal';
import { useMedicationCatalog } from '../medicationCatalog';
import { getMedicationIcon } from '../medicationIcons';

const PracticeDashboard: React.FC = () => {
  const [practiceName, setPracticeName] = useState('');
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [savedMeds, setSavedMeds] = useState<string[]>([]);
  const [linkVisitCount, setLinkVisitCount] = useState(0);
  const [lastAccessedMs, setLastAccessedMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [previewMed, setPreviewMed] = useState<MedContent | null>(null);
  const { medications: allMedications, loading: loadingMedications } = useMedicationCatalog();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadPractice();
      } else {
        navigate('/practice');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadPractice = async () => {
    setLoading(true);
    try {
      const getMyPractice = httpsCallable(functions, 'getMyPractice');
      const result = await getMyPractice();
      const data = result.data as { found: boolean; practice?: Record<string, unknown>; practiceId?: string };

      if (data.found && data.practice) {
        setPracticeName(data.practice.name as string);
        const meds = (data.practice.selected_medications as string[]) || [];
        setSelectedMeds(meds);
        setSavedMeds(meds);
        setLinkVisitCount((data.practice.link_visit_count as number) || 0);
        setLastAccessedMs((data.practice.last_accessed_ms as number | null) || null);
      } else {
        setError('No practice linked to this account. Contact your administrator.');
      }
    } catch (err) {
      console.error('Error loading practice:', err);
      setError('Unable to load practice data. Please try again.');
    }
    setLoading(false);
  };

  const toggleMed = (code: string) => {
    setSaveSuccess(false);
    setSelectedMeds(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleAll = () => {
    setSaveSuccess(false);
    const allCodes = allMedications.map(m => m.code);
    if (selectedMeds.length === allCodes.length) {
      setSelectedMeds([]);
    } else {
      setSelectedMeds(allCodes);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updateMeds = httpsCallable(functions, 'updatePracticeMedications');
      await updateMeds({ medications: selectedMeds });
      setSavedMeds([...selectedMeds]);
      setSaveSuccess(true);
    } catch (err) {
      console.error('Error saving:', err);
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/practice');
  };

  const hasChanges = JSON.stringify(selectedMeds.sort()) !== JSON.stringify(savedMeds.sort());
  const allSelected = allMedications.length > 0 && selectedMeds.length === allMedications.length;
  const lastAccessedLabel = lastAccessedMs
    ? new Date(lastAccessedMs).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No patient visits yet';

  if (loading || loadingMedications) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <FlaskConical size={48} color="#005eb8" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.25rem' }}>Loading your practice...</h1>
        </div>
      </div>
    );
  }

  if (error && !practiceName) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center', borderLeft: '4px solid #d5281b' }}>
          <h1 style={{ fontSize: '1.25rem', color: '#d5281b' }}>Error</h1>
          <p>{error}</p>
          <button onClick={handleSignOut} className="action-button" style={{ backgroundColor: '#d5281b' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Group medications by category
  const selectedMedicationSet = useMemo(() => new Set(selectedMeds), [selectedMeds]);

  const activeMedications = useMemo(
    () => allMedications.filter((med) => selectedMedicationSet.has(med.code)),
    [allMedications, selectedMedicationSet],
  );

  const availableMedications = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    return allMedications.filter((med) => {
      if (!query) return true;
      return [
        med.title,
        med.category,
        med.description,
        med.code,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [allMedications, librarySearch]);

  const categories = availableMedications.reduce((acc, med) => {
    if (!acc[med.category]) acc[med.category] = [];
    acc[med.category].push(med);
    return acc;
  }, {} as Record<string, MedContent[]>);

  return (
    <div className="dashboard-shell">
      {previewMed && <MedicationPreviewModal med={previewMed} onClose={() => setPreviewMed(null)} />}

      <div className="dashboard-header">
        <div className="dashboard-header-copy">
          <h1>
            <FlaskConical size={28} color="#005eb8" /> {practiceName}
          </h1>
          <p>Select which medication information blocks are live for patients and manage your available library.</p>
        </div>
        <div className="dashboard-actions">
          <button onClick={handleSignOut} className="action-button" style={{ backgroundColor: '#d5281b' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {error && practiceName && (
        <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="dashboard-stat-grid dashboard-section">
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">Patient link uses</div>
          <div className="dashboard-stat-value">{linkVisitCount}</div>
          <p className="dashboard-stat-copy">
            Increases each time your active SystmOne patient link is opened successfully.
          </p>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">Last patient access</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212b32' }}>{lastAccessedLabel}</div>
          <p className="dashboard-stat-copy">
            This updates when a patient opens a valid link for your practice.
          </p>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">Live medication blocks</div>
          <div className="dashboard-stat-value">{activeMedications.length}</div>
          <p className="dashboard-stat-copy">
            These are the medication guides currently available to your patients.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="dashboard-banner dashboard-banner--success" style={{ marginBottom: '1rem' }}>
          <CheckCircle size={18} /> Medication selections saved successfully.
        </div>
      )}

      <section className="dashboard-section">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Live for Patients</h2>
              <p className="dashboard-panel-subtitle">
                This is the current patient-facing set for your practice.
              </p>
            </div>
            <div className="dashboard-inline-actions">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="action-button"
                style={{
                  backgroundColor: hasChanges ? '#007f3b' : '#d8dde0',
                  cursor: hasChanges ? 'pointer' : 'default',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {activeMedications.length === 0 ? (
            <div className="dashboard-banner dashboard-banner--info" style={{ marginBottom: '1rem' }}>
              No medication blocks are live yet. Use the library below to select what patients should see.
            </div>
          ) : (
            <div className="dashboard-list" style={{ marginBottom: '1rem' }}>
              {activeMedications.map((med) => (
                <div key={med.code} className="dashboard-list-card dashboard-list-card--selected">
                  <div style={{ color: '#005eb8', flexShrink: 0 }}>{getMedicationIcon(med.code)}</div>
                  <div className="dashboard-list-main">
                    <div className="dashboard-list-title">{med.title}</div>
                    <p className="dashboard-list-copy">
                      {med.description.length > 120 ? med.description.slice(0, 120) + '...' : med.description}
                    </p>
                    <div className="dashboard-meta">
                      <span className="dashboard-badge dashboard-badge--blue">{med.code}</span>
                      <span className={`dashboard-badge ${med.badge === 'NEW' ? 'dashboard-badge--blue' : 'dashboard-badge--green'}`}>
                        {med.badge}
                      </span>
                      <span className="dashboard-badge dashboard-badge--amber">{med.category}</span>
                    </div>
                  </div>
                  <div className="dashboard-list-actions">
                    <button
                      onClick={() => setPreviewMed(med)}
                      className="dashboard-pill-button"
                    >
                      <Eye size={14} /> Preview
                    </button>
                    <button
                      onClick={() => toggleMed(med.code)}
                      className="dashboard-pill-button dashboard-pill-button--danger"
                    >
                      <Square size={14} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="dashboard-chip-row">
            {activeMedications.map((med) => (
              <span key={med.code} className="dashboard-chip dashboard-chip--active">
                {med.code} {med.title.split(' - ')[0]}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-panel">
          <div className="dashboard-toolbar">
            <div>
              <h2 className="dashboard-panel-title">Available Medication Library</h2>
              <p className="dashboard-panel-subtitle">
                Search, preview, and choose which medication guides should be available through your SystmOne link.
              </p>
            </div>
            <div className="dashboard-inline-actions">
            <button
              onClick={toggleAll}
              className="action-button"
              style={{ backgroundColor: allSelected ? '#4c6272' : '#005eb8' }}
            >
              {allSelected ? <><Square size={16} /> Deselect All</> : <><CheckSquare size={16} /> Select All</>}
            </button>
            </div>
          </div>

          <div className="dashboard-toolbar">
            <div className="dashboard-search">
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search by name, code, category, or description"
              />
            </div>
            <div className="dashboard-chip-row">
              <span className="dashboard-chip">{availableMedications.length} shown</span>
              <span className="dashboard-chip dashboard-chip--active">{selectedMeds.length} selected</span>
            </div>
          </div>

          {Object.entries(categories).length === 0 ? (
            <div className="dashboard-banner dashboard-banner--info">
              No medication blocks match your search.
            </div>
          ) : Object.entries(categories).map(([category, meds]) => (
          <div key={category} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#4c6272', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', borderBottom: '1px solid #d8dde0', paddingBottom: '0.5rem' }}>
              {category}
            </h3>
            <div className="dashboard-list">
              {meds.map(med => {
                const isSelected = selectedMeds.includes(med.code);
                return (
                  <div
                    key={med.code}
                    className={`dashboard-list-card${isSelected ? ' dashboard-list-card--selected' : ''}`}
                  >
                    <div
                      onClick={() => toggleMed(med.code)}
                      style={{
                        width: '24px', height: '24px', borderRadius: '4px',
                        border: `2px solid ${isSelected ? '#005eb8' : '#d8dde0'}`,
                        background: isSelected ? '#005eb8' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, cursor: 'pointer',
                      }}
                    >
                      {isSelected && <CheckCircle size={16} color="white" />}
                    </div>
                    <div
                      onClick={() => toggleMed(med.code)}
                      style={{ color: isSelected ? '#005eb8' : '#4c6272', flexShrink: 0, cursor: 'pointer' }}
                    >
                      {getMedicationIcon(med.code)}
                    </div>
                    <div className="dashboard-list-main" style={{ cursor: 'pointer' }} onClick={() => toggleMed(med.code)}>
                      <div className="dashboard-list-title" style={{ color: isSelected ? '#003087' : '#212b32' }}>
                        {med.title}
                      </div>
                      <div className="dashboard-list-copy">
                        {med.description.length > 80 ? med.description.slice(0, 80) + '...' : med.description}
                      </div>
                      <div className="dashboard-meta">
                        <span className={`dashboard-badge ${med.badge === 'NEW' ? 'dashboard-badge--blue' : 'dashboard-badge--green'}`}>
                          {med.badge}
                        </span>
                        <span className="dashboard-badge dashboard-badge--amber">{med.category}</span>
                      </div>
                    </div>
                    <div className="dashboard-list-actions">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewMed(med); }}
                        title="Preview patient content"
                        className="dashboard-pill-button"
                      >
                        <Eye size={14} /> Preview
                      </button>
                      <div className={`dashboard-badge ${isSelected ? 'dashboard-badge--blue' : 'dashboard-badge--amber'}`}>
                        {med.code}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        </div>
      </section>
    </div>
  );
};

export default PracticeDashboard;
