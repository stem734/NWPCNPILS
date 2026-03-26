import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, CheckCircle, XCircle, Trash2, RefreshCw, Plus, X, FlaskConical } from 'lucide-react';

interface Practice {
  id: string;
  name: string;
  name_lowercase: string;
  is_active: boolean;
  ods_code?: string;
  contact_email?: string;
  signed_up_at?: Timestamp;
  last_accessed?: Timestamp;
}

const AdminDashboard: React.FC = () => {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOds, setNewOds] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addError, setAddError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
        loadPractices();
      } else {
        navigate('/admin');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadPractices = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'practices'));
      const practiceList: Practice[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as Practice));
      setPractices(practiceList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading practices:', error);
    }
    setLoading(false);
  };

  const toggleActive = async (practice: Practice) => {
    try {
      await updateDoc(doc(db, 'practices', practice.id), {
        is_active: !practice.is_active,
      });
      loadPractices();
    } catch (error) {
      console.error('Error updating practice:', error);
    }
  };

  const deletePractice = async (practice: Practice) => {
    if (!confirm(`Are you sure you want to remove "${practice.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'practices', practice.id));
      loadPractices();
    } catch (error) {
      console.error('Error deleting practice:', error);
    }
  };

  const addPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!newName.trim()) {
      setAddError('Organisation name is required');
      return;
    }

    if (!newEmail.trim()) {
      setAddError('Contact email is required to create practice login');
      return;
    }

    // TODO: Uncomment for production - restrict to nhs.net only
    // if (!newEmail.trim().toLowerCase().endsWith('@nhs.net')) {
    //   setAddError('Only nhs.net email addresses are accepted');
    //   return;
    // }

    try {
      // 1. Create the practice document
      const docRef = await addDoc(collection(db, 'practices'), {
        name: newName.trim(),
        name_lowercase: newName.trim().toLowerCase(),
        ods_code: newOds.trim().toUpperCase(),
        contact_email: newEmail.trim(),
        is_active: true,
        selected_medications: [],
        signed_up_at: Timestamp.now(),
      });

      // 2. Create Firebase Auth account for the practice via Cloud Function
      try {
        const createUser = httpsCallable(functions, 'createPracticeUser');
        await createUser({ email: newEmail.trim(), practiceId: docRef.id });
      } catch (authErr) {
        console.warn('Auth account creation failed (practice still added):', authErr);
      }

      setNewName('');
      setNewOds('');
      setNewEmail('');
      setShowAddForm(false);
      loadPractices();
    } catch (error) {
      console.error('Error adding practice:', error);
      setAddError('Failed to add practice. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/admin');
  };

  if (!authenticated) return null;

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={28} color="#005eb8" /> Admin Dashboard
          </h1>
          <p style={{ color: '#4c6272', margin: '0.25rem 0 0' }}>Manage registered practices</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => navigate('/admin/drug-builder')} className="action-button" style={{ backgroundColor: '#005eb8' }}>
            <FlaskConical size={16} /> Drug Builder
          </button>
          <button onClick={loadPractices} className="action-button" style={{ backgroundColor: '#4c6272' }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={handleSignOut} className="action-button" style={{ backgroundColor: '#d5281b' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Add Practice</h2>
            <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {addError && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {addError}
            </div>
          )}
          <form onSubmit={addPractice} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Organisation Name *</label>
              <input
                type="text" value={newName} onChange={e => setNewName(e.target.value)} required
                placeholder="Exact name as in SystmOne"
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>ODS Code</label>
                <input
                  type="text" value={newOds} onChange={e => setNewOds(e.target.value)}
                  placeholder="e.g. C84001"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Contact Email *</label>
                <input
                  type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                  placeholder="e.g. admin@nhs.net"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <button type="submit" className="action-button" style={{ alignSelf: 'flex-start' }}>
              <Plus size={16} /> Add & Activate Practice
            </button>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
            Registered Practices ({practices.length})
          </h2>
          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} className="action-button" style={{ backgroundColor: '#007f3b' }}>
              <Plus size={16} /> Add Practice
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: '#4c6272' }}>Loading practices...</p>
        ) : practices.length === 0 ? (
          <p style={{ color: '#4c6272' }}>No practices registered yet. Share the sign-up link with practices.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {practices.map(practice => (
              <div
                key={practice.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem', background: practice.is_active ? '#f0f9f0' : '#fef7f0',
                  borderRadius: '8px', border: `1px solid ${practice.is_active ? '#007f3b' : '#d5281b'}20`
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{practice.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#4c6272', display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                    {practice.ods_code && <span>ODS: {practice.ods_code}</span>}
                    {practice.contact_email && <span>{practice.contact_email}</span>}
                    {practice.last_accessed && (
                      <span>Last active: {practice.last_accessed.toDate?.().toLocaleDateString() || 'N/A'}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {practice.is_active ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#007f3b', fontWeight: 600, fontSize: '0.85rem' }}>
                      <CheckCircle size={16} /> Active
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#d5281b', fontWeight: 600, fontSize: '0.85rem' }}>
                      <XCircle size={16} /> Inactive
                    </span>
                  )}
                  <button
                    onClick={() => toggleActive(practice)}
                    style={{
                      padding: '0.4rem 0.75rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '0.8rem', fontWeight: 600,
                      background: practice.is_active ? '#d5281b' : '#007f3b', color: 'white'
                    }}
                  >
                    {practice.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deletePractice(practice)}
                    style={{
                      padding: '0.4rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
                      background: '#f0f4f5', color: '#d5281b', display: 'flex'
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

      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Sign-up Link</h2>
        <p style={{ color: '#4c6272', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Share this link with practices that want to register:
        </p>
        <div style={{
          padding: '0.75rem 1rem', background: '#eef7ff', borderRadius: '8px',
          fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all',
          border: '1px solid #005eb8'
        }}>
          {window.location.origin}/signup
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
