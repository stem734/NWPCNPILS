import React, { useState, useEffect } from 'react';
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
  const categories = allMedications.reduce((acc, med) => {
    if (!acc[med.category]) acc[med.category] = [];
    acc[med.category].push(med);
    return acc;
  }, {} as Record<string, MedContent[]>);

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
      {previewMed && <MedicationPreviewModal med={previewMed} onClose={() => setPreviewMed(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FlaskConical size={28} color="#005eb8" /> {practiceName}
          </h1>
          <p style={{ color: '#4c6272', margin: '0.25rem 0 0' }}>Select which medication information blocks to show your patients</p>
        </div>
        <button onClick={handleSignOut} className="action-button" style={{ backgroundColor: '#d5281b' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {error && practiceName && (
        <div style={{ padding: '0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.85rem', color: '#4c6272', marginBottom: '0.35rem' }}>Patient link uses</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#005eb8' }}>{linkVisitCount}</div>
          <p style={{ color: '#4c6272', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
            Increases each time your active SystmOne patient link is opened successfully.
          </p>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.85rem', color: '#4c6272', marginBottom: '0.35rem' }}>Last patient access</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212b32' }}>{lastAccessedLabel}</div>
          <p style={{ color: '#4c6272', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
            This updates when a patient opens a valid link for your practice.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div style={{ padding: '0.75rem', background: '#f0f9f0', color: '#007f3b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} /> Medication selections saved successfully.
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
            Medication Information Blocks ({selectedMeds.length} selected)
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={toggleAll}
              className="action-button"
              style={{ backgroundColor: allSelected ? '#4c6272' : '#005eb8' }}
            >
              {allSelected ? <><Square size={16} /> Deselect All</> : <><CheckSquare size={16} /> Select All</>}
            </button>
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

        <p style={{ color: '#4c6272', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Toggle the medication blocks you want to provide to your patients. Click the preview button to review the full content before selecting.
        </p>

        {Object.entries(categories).map(([category, meds]) => (
          <div key={category} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#4c6272', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', borderBottom: '1px solid #d8dde0', paddingBottom: '0.5rem' }}>
              {category}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {meds.map(med => {
                const isSelected = selectedMeds.includes(med.code);
                return (
                  <div
                    key={med.code}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '1rem', borderRadius: '8px',
                      border: `2px solid ${isSelected ? '#005eb8' : '#d8dde0'}`,
                      background: isSelected ? '#eef7ff' : 'white',
                      transition: 'all 0.15s ease',
                    }}
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
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleMed(med.code)}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isSelected ? '#003087' : '#212b32' }}>
                        {med.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#4c6272', marginTop: '0.15rem' }}>
                        {med.description.length > 80 ? med.description.slice(0, 80) + '...' : med.description}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewMed(med); }}
                      title="Preview patient content"
                      style={{
                        padding: '0.4rem 0.75rem', border: '1px solid #005eb8', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        background: 'white', color: '#005eb8', display: 'flex', alignItems: 'center', gap: '0.3rem',
                        flexShrink: 0,
                      }}
                    >
                      <Eye size={14} /> Preview
                    </button>
                    <div style={{
                      padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                      background: isSelected ? '#005eb8' : '#f0f4f5', color: isSelected ? 'white' : '#4c6272',
                    }}>
                      {med.code}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PracticeDashboard;
