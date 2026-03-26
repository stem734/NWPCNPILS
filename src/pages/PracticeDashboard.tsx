import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { LogOut, Pill, Droplets, Thermometer, FlaskConical, Monitor, CheckCircle, Save } from 'lucide-react';

interface MedBlock {
  code: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

const ALL_MEDICATIONS: MedBlock[] = [
  { code: '101', title: 'Sulfonylurea - Starting Treatment', description: 'New prescription guidance for Gliclazide and similar', icon: <Pill size={20} />, category: 'Sulfonylureas' },
  { code: '102', title: 'Sulfonylurea - Reauthorisation', description: 'Annual review reminder for existing Sulfonylurea patients', icon: <Monitor size={20} />, category: 'Sulfonylureas' },
  { code: '201', title: 'SGLT2 Inhibitor - First Initiation', description: 'New prescription guidance for Dapagliflozin, Empagliflozin', icon: <Droplets size={20} />, category: 'SGLT2 Inhibitors' },
  { code: '202', title: 'SGLT2 Inhibitor - Reauthorisation', description: 'Annual review for existing SGLT2 patients', icon: <Droplets size={20} />, category: 'SGLT2 Inhibitors' },
  { code: '301', title: 'Emollients and Skin Care', description: 'Safe use of emollients and moisturisers', icon: <Droplets size={20} />, category: 'Dermatology' },
  { code: '401', title: 'Insulin Therapy', description: 'Insulin injection guidance and safety', icon: <Thermometer size={20} />, category: 'Insulin' },
  { code: '501', title: 'Mounjaro (Tirzepatide)', description: 'GLP-1/GIP receptor agonist guidance', icon: <FlaskConical size={20} />, category: 'GLP-1 / GIP' },
];

const PracticeDashboard: React.FC = () => {
  const [practiceName, setPracticeName] = useState('');
  const [practiceId, setPracticeId] = useState('');
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [savedMeds, setSavedMeds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
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
        setPracticeId(data.practiceId || '');
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
  const categories = ALL_MEDICATIONS.reduce((acc, med) => {
    if (!acc[med.category]) acc[med.category] = [];
    acc[med.category].push(med);
    return acc;
  }, {} as Record<string, MedBlock[]>);

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
            Medication Information Blocks ({selectedMeds.length} selected)
          </h2>
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

        <p style={{ color: '#4c6272', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Toggle the medication blocks you want to provide to your patients. Only selected blocks will appear when patients access the portal via SystmOne.
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
                    onClick={() => toggleMed(med.code)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '1rem', borderRadius: '8px', cursor: 'pointer',
                      border: `2px solid ${isSelected ? '#005eb8' : '#d8dde0'}`,
                      background: isSelected ? '#eef7ff' : 'white',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '4px',
                      border: `2px solid ${isSelected ? '#005eb8' : '#d8dde0'}`,
                      background: isSelected ? '#005eb8' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSelected && <CheckCircle size={16} color="white" />}
                    </div>
                    <div style={{ color: isSelected ? '#005eb8' : '#4c6272', flexShrink: 0 }}>
                      {med.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isSelected ? '#003087' : '#212b32' }}>
                        {med.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#4c6272', marginTop: '0.15rem' }}>
                        {med.description}
                      </div>
                    </div>
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

      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>SystmOne URL Format</h2>
        <p style={{ color: '#4c6272', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Your patients will access medication information through this URL structure:
        </p>
        <div style={{
          padding: '0.75rem 1rem', background: '#eef7ff', borderRadius: '8px',
          fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all',
          border: '1px solid #005eb8'
        }}>
          {window.location.origin}/?org={encodeURIComponent(practiceName)}&codes={selectedMeds.length > 0 ? selectedMeds.join(',') : '...'}
        </div>
      </div>
    </div>
  );
};

export default PracticeDashboard;
