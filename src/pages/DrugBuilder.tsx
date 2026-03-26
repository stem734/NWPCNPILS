import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Trash2, Save, Copy, CheckCircle, ExternalLink, Link, AlertCircle } from 'lucide-react';

interface TrendLink {
  title: string;
  url: string;
}

interface SavedMed {
  code: string;
  title: string;
  description: string;
  badge: string;
  category: string;
  keyInfo: string[];
  nhsLink: string;
  trendLinks: TrendLink[];
  sickDaysNeeded: boolean;
}

const DrugBuilder: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Search / generate
  const [medName, setMedName] = useState('');
  const [medType, setMedType] = useState<'NEW' | 'REAUTH' | 'GENERAL'>('NEW');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Editable fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState<'NEW' | 'REAUTH' | 'GENERAL'>('NEW');
  const [category, setCategory] = useState('');
  const [keyInfo, setKeyInfo] = useState<string[]>(['']);
  const [nhsLink, setNhsLink] = useState('');
  const [trendLinks, setTrendLinks] = useState<TrendLink[]>([]);
  const [sickDaysNeeded, setSickDaysNeeded] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedCode, setSavedCode] = useState('');
  const [saveError, setSaveError] = useState('');

  // Existing custom medications
  const [existingMeds, setExistingMeds] = useState<SavedMed[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [deletingCode, setDeletingCode] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
        loadExistingMeds();
      } else {
        navigate('/admin');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadExistingMeds = async () => {
    setLoadingMeds(true);
    try {
      const listMeds = httpsCallable(functions, 'listMedications');
      const result = await listMeds();
      const data = result.data as { medications: SavedMed[] };
      setExistingMeds(data.medications || []);
    } catch {
      console.error('Error loading medications');
    }
    setLoadingMeds(false);
  };

  const handleGenerate = async () => {
    if (!medName.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const generate = httpsCallable(functions, 'generateMedicationContent');
      const result = await generate({ medicationName: medName.trim(), type: medType });
      const data = result.data as { success: boolean; content: Record<string, unknown> };

      if (data.success && data.content) {
        const c = data.content;
        setTitle((c.title as string) || medName);
        setDescription((c.description as string) || '');
        setBadge(medType);
        setCategory((c.category as string) || '');
        setKeyInfo((c.keyInfo as string[]) || ['']);
        setNhsLink((c.nhsLink as string) || '');
        setSickDaysNeeded((c.sickDaysNeeded as boolean) || false);
        setTrendLinks([]);
        setHasContent(true);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setGenError('AI generation failed. You can fill in the fields manually below.');
      // Still show the editor so they can fill manually
      setTitle(medName);
      setBadge(medType);
      setKeyInfo(['']);
      setHasContent(true);
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
      const save = httpsCallable(functions, 'saveMedication');
      const result = await save({
        title: title.trim(),
        description: description.trim(),
        badge,
        category: category.trim(),
        keyInfo: keyInfo.filter(k => k.trim()),
        nhsLink: nhsLink.trim(),
        trendLinks: trendLinks.filter(l => l.title.trim() && l.url.trim()),
        sickDaysNeeded,
      });
      const data = result.data as { success: boolean; code: string };
      if (data.success) {
        setSavedCode(data.code);
        loadExistingMeds();
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveError('Failed to save medication. Please try again.');
    }
    setSaving(false);
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Delete medication ${code}? This cannot be undone.`)) return;
    setDeletingCode(code);
    try {
      const del = httpsCallable(functions, 'deleteMedication');
      await del({ code });
      loadExistingMeds();
    } catch {
      console.error('Delete error');
    }
    setDeletingCode('');
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
    setTitle('');
    setDescription('');
    setBadge('NEW');
    setCategory('');
    setKeyInfo(['']);
    setNhsLink('');
    setTrendLinks([]);
    setSickDaysNeeded(false);
    setHasContent(false);
    setSavedCode('');
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
      <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <CheckCircle size={64} color="#007f3b" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', color: '#007f3b' }}>Medication Created</h1>
          <p style={{ color: '#4c6272', marginBottom: '1.5rem' }}>
            <strong>{title}</strong> has been saved successfully.
          </p>

          <div style={{
            padding: '1.5rem', background: '#eef7ff', borderRadius: '12px',
            border: '2px solid #005eb8', marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '0.85rem', color: '#4c6272', marginBottom: '0.5rem' }}>SystmOne Code</div>
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
            Add code <strong>{savedCode}</strong> to your clinical protocol output.
            When included in the URL as <code>codes=...{savedCode}</code>, patients will see this medication information.
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={resetForm} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Plus size={16} /> Create Another
            </button>
            <button onClick={() => navigate('/admin/dashboard')} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/admin/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#005eb8', display: 'flex' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Drug Builder</h1>
          <p style={{ color: '#4c6272', margin: '0.25rem 0 0' }}>Create new medication information blocks with AI assistance</p>
        </div>
      </div>

      {/* Step 1: Search and Generate */}
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>1. Medication Search</h2>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={medName}
            onChange={e => setMedName(e.target.value)}
            placeholder="Enter medication name (e.g. Metformin, Atorvastatin)"
            style={{
              flex: 1, minWidth: '200px', padding: '0.75rem', border: '2px solid #d8dde0',
              borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box',
            }}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          />
          <select
            value={medType}
            onChange={e => setMedType(e.target.value as 'NEW' | 'REAUTH' | 'GENERAL')}
            style={{
              padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px',
              fontSize: '0.95rem', background: 'white',
            }}
          >
            <option value="NEW">New Prescription</option>
            <option value="REAUTH">Reauthorisation</option>
            <option value="GENERAL">General Info</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating || !medName.trim()}
            className="action-button"
            style={{ backgroundColor: '#005eb8', opacity: generating || !medName.trim() ? 0.6 : 1 }}
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
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>2. Edit Content</h2>

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
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Category *</label>
                <input
                  type="text" value={category} onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Diabetes, Cardiovascular"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Type</label>
                <select
                  value={badge} onChange={e => setBadge(e.target.value as 'NEW' | 'REAUTH' | 'GENERAL')}
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', background: 'white' }}
                >
                  <option value="NEW">New Medication</option>
                  <option value="REAUTH">Reauthorisation</option>
                  <option value="GENERAL">General Info</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'end', paddingBottom: '0.2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                  <input
                    type="checkbox" checked={sickDaysNeeded} onChange={e => setSickDaysNeeded(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  Sick Day Rules
                </label>
              </div>
            </div>

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

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="action-button"
              style={{ backgroundColor: '#007f3b', opacity: saving ? 0.6 : 1 }}
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Medication'}
            </button>
            <button onClick={resetForm} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Existing custom medications */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Custom Medications</h2>
        {loadingMeds ? (
          <p style={{ color: '#4c6272' }}>Loading...</p>
        ) : existingMeds.length === 0 ? (
          <p style={{ color: '#4c6272' }}>No custom medications created yet. Use the search above to create your first one.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {existingMeds.map(med => (
              <div
                key={med.code}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem', background: '#f8fafb', borderRadius: '8px',
                  border: '1px solid #d8dde0',
                }}
              >
                <div style={{
                  padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem',
                  fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white',
                  minWidth: '40px', textAlign: 'center',
                }}>
                  {med.code}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{med.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#4c6272', display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
                    <span>{med.category}</span>
                    <span style={{
                      padding: '0 0.4rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700,
                      background: med.badge === 'NEW' ? '#005eb8' : med.badge === 'REAUTH' ? '#007f3b' : '#4c6272',
                      color: 'white',
                    }}>
                      {med.badge}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => copyCode(med.code)}
                  title="Copy SystmOne code"
                  style={{
                    background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8',
                    borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                  }}
                >
                  <Copy size={14} /> Copy
                </button>
                <button
                  onClick={() => handleDelete(med.code)}
                  disabled={deletingCode === med.code}
                  style={{
                    background: '#fde8e8', border: 'none', color: '#d5281b',
                    borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', display: 'flex',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrugBuilder;
