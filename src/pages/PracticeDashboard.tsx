import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, functions, db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { LogOut, Pill, Droplets, Thermometer, FlaskConical, Monitor, CheckCircle, Save, Eye, X, ExternalLink, Info, ShieldAlert, CheckSquare, Square } from 'lucide-react';
import { MEDICATIONS } from '../medicationData';
import type { MedContent } from '../medicationData';

const ICON_MAP: Record<string, React.ReactNode> = {
  '101': <Pill size={20} />,
  '102': <Monitor size={20} />,
  '201': <Droplets size={20} />,
  '202': <Droplets size={20} />,
  '301': <Droplets size={20} />,
  '401': <Thermometer size={20} />,
  '501': <FlaskConical size={20} />,
};

const PreviewModal: React.FC<{ med: MedContent; onClose: () => void }> = ({ med, onClose }) => {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '12px', maxWidth: '700px', width: '100%',
          maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          position: 'sticky', top: 0, background: 'white', padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #d8dde0', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderRadius: '12px 12px 0 0', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Eye size={20} color="#005eb8" />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#005eb8' }}>Patient Preview</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272', padding: '0.25rem' }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <span style={{
            display: 'inline-block', padding: '0.2rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem',
            fontWeight: 700, marginBottom: '1rem', letterSpacing: '0.05em',
            background: med.badge === 'NEW' ? '#005eb8' : med.badge === 'REAUTH' ? '#007f3b' : '#4c6272',
            color: 'white',
          }}>
            {med.badge === 'NEW' ? 'NEW MEDICATION' : med.badge === 'REAUTH' ? 'ANNUAL REVIEW' : 'MEDICATION INFORMATION'}
          </span>

          {med.badge === 'NEW' && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#eef7ff', borderRadius: '8px', borderLeft: '4px solid #005eb8' }}>
              <div style={{ fontWeight: 700, color: '#005eb8', marginBottom: '0.25rem' }}>Beginning Your Treatment</div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#212b32' }}>
                You are starting a new course of treatment. This information will help you understand your medication and how to take it safely.
              </p>
            </div>
          )}

          {med.badge === 'REAUTH' && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f4f5', borderRadius: '8px', borderLeft: '4px solid #005eb8' }}>
              <div style={{ fontWeight: 700, color: '#212b32', marginBottom: '0.25rem' }}>Annual Treatment Reminder</div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#4c6272' }}>
                As you have been taking this medication for 12 months or more, we are sending this as a routine review reminder of safe management.
              </p>
            </div>
          )}

          <h2 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: '#005eb8' }}>{ICON_MAP[med.code]}</span>
            {med.title}
          </h2>
          <p style={{ color: '#212b32', fontSize: '1rem', lineHeight: 1.6 }}>{med.description}</p>

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Key Information</h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {med.keyInfo.map((info, i) => (
                <li key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                  <Info size={20} color="#005eb8" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span style={{ fontSize: '0.95rem' }}>{info}</span>
                </li>
              ))}
            </ul>
          </div>

          {med.sickDaysNeeded && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#fde8e8', borderRadius: '8px', borderLeft: '4px solid #d5281b' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                <ShieldAlert size={20} color="#d5281b" />
                <strong style={{ color: '#d5281b' }}>Sick Day Rules Apply</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#212b32' }}>
                If you become unwell and are unable to eat or drink normally, you may need to pause this medication.
              </p>
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Linked Resources</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {med.nhsLink && (
                <a href={med.nhsLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#eef7ff', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: '#005eb8', color: 'white', padding: '0.15rem 0.4rem', fontWeight: 800, fontSize: '0.7rem', borderRadius: '2px' }}>NHS</div>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>Official NHS Guidance</span>
                  <ExternalLink size={16} color="#005eb8" />
                </a>
              )}
              {med.trendLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f0f9f0', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}>
                  <FlaskConical size={16} color="#007f3b" />
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{link.title}</span>
                  <ExternalLink size={16} color="#007f3b" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          padding: '1rem 1.5rem', background: '#f8fafb', borderTop: '1px solid #d8dde0',
          borderRadius: '0 0 12px 12px', fontSize: '0.8rem', color: '#4c6272', textAlign: 'center',
        }}>
          This is a preview of what patients will see when they access this medication block.
        </div>
      </div>
    </div>
  );
};

const PracticeDashboard: React.FC = () => {
  const [practiceName, setPracticeName] = useState('');
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [savedMeds, setSavedMeds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [previewMed, setPreviewMed] = useState<MedContent | null>(null);
  const [allMedications, setAllMedications] = useState<MedContent[]>(MEDICATIONS);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadPractice();
        loadCustomMeds();
      } else {
        navigate('/practice');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadCustomMeds = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'medications'));
      const custom: MedContent[] = snapshot.docs.map(doc => doc.data() as MedContent);
      setAllMedications([...MEDICATIONS, ...custom]);
    } catch {
      // Custom meds not critical
    }
  };

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
  const allSelected = selectedMeds.length === allMedications.length;

  if (loading) {
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
      {previewMed && <PreviewModal med={previewMed} onClose={() => setPreviewMed(null)} />}

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
                      {ICON_MAP[med.code]}
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
