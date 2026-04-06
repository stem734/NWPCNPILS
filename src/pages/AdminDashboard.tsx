import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, CheckCircle, XCircle, Trash2, RefreshCw, Plus, X, FlaskConical, Edit2 } from 'lucide-react';

interface Practice {
  id: string;
  name: string;
  name_lowercase: string;
  is_active: boolean;
  ods_code?: string;
  contact_email?: string;
  signed_up_at?: Timestamp;
  last_accessed?: Timestamp;
  link_visit_count?: number;
}

interface AdminUser {
  uid: string;
  email: string;
  name: string;
  is_active: boolean;
  role: 'owner' | 'admin';
}

const AdminDashboard: React.FC = () => {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOds, setNewOds] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addAdminError, setAddAdminError] = useState('');
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editOds, setEditOds] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminActive, setEditAdminActive] = useState(true);
  const [editAdminError, setEditAdminError] = useState('');
  const [adminActionLink, setAdminActionLink] = useState('');
  const [adminActionMessage, setAdminActionMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
        loadPractices();
        loadAdmins();
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

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const listAdmins = httpsCallable(functions, 'listAdminUsers');
      const result = await listAdmins();
      const data = result.data as { admins: AdminUser[] };
      setAdminUsers((data.admins || []).sort((a, b) => a.email.localeCompare(b.email)));
    } catch (error) {
      console.error('Error loading admins:', error);
    }
    setLoadingAdmins(false);
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
        link_visit_count: 0,
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

  const openEditForm = (practice: Practice) => {
    setEditingPractice(practice);
    setEditName(practice.name);
    setEditOds(practice.ods_code || '');
    setEditEmail(practice.contact_email || '');
    setEditError('');
  };

  const savePracticeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!editingPractice) return;

    if (!editName.trim()) {
      setEditError('Organisation name is required');
      return;
    }

    if (!editEmail.trim()) {
      setEditError('Contact email is required');
      return;
    }

    try {
      await updateDoc(doc(db, 'practices', editingPractice.id), {
        name: editName.trim(),
        name_lowercase: editName.trim().toLowerCase(),
        ods_code: editOds.trim().toUpperCase(),
        contact_email: editEmail.trim(),
      });

      setEditingPractice(null);
      loadPractices();
    } catch (error) {
      console.error('Error updating practice:', error);
      setEditError('Failed to update practice. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/admin');
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAdminError('');
    setAdminActionLink('');
    setAdminActionMessage('');

    if (!newAdminEmail.trim()) {
      setAddAdminError('Administrator email is required');
      return;
    }

    try {
      const createAdmin = httpsCallable(functions, 'createAdminUser');
      const result = await createAdmin({
        email: newAdminEmail.trim(),
        name: newAdminName.trim(),
      });
      const data = result.data as { resetLink?: string };
      setNewAdminName('');
      setNewAdminEmail('');
      setShowAddAdminForm(false);
      setAdminActionMessage(`Administrator created. Copy the setup link below and send it to ${newAdminEmail.trim()}.`);
      setAdminActionLink(data.resetLink || '');
      loadAdmins();
    } catch (error) {
      console.error('Error adding admin:', error);
      setAddAdminError(error instanceof Error ? error.message : 'Failed to add administrator');
    }
  };

  const openAdminEditForm = (adminUser: AdminUser) => {
    setEditingAdmin(adminUser);
    setEditAdminName(adminUser.name);
    setEditAdminEmail(adminUser.email);
    setEditAdminActive(adminUser.is_active);
    setEditAdminError('');
  };

  const saveAdminEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditAdminError('');

    if (!editingAdmin) return;

    try {
      const updateAdmin = httpsCallable(functions, 'updateAdminUser');
      await updateAdmin({
        uid: editingAdmin.uid,
        email: editAdminEmail.trim(),
        name: editAdminName.trim(),
        isActive: editAdminActive,
      });
      setEditingAdmin(null);
      loadAdmins();
    } catch (error) {
      console.error('Error updating admin:', error);
      setEditAdminError(error instanceof Error ? error.message : 'Failed to update administrator');
    }
  };

  const resetAdminPassword = async (adminUser: AdminUser) => {
    try {
      const resetAdmin = httpsCallable(functions, 'sendAdminPasswordReset');
      const result = await resetAdmin({ uid: adminUser.uid });
      const data = result.data as { resetLink?: string };
      setAdminActionMessage(`Password reset link prepared for ${adminUser.email}. Copy and send it manually.`);
      setAdminActionLink(data.resetLink || '');
    } catch (error) {
      console.error('Error sending reset:', error);
      alert(error instanceof Error ? error.message : 'Failed to send password reset');
    }
  };

  const deleteAdmin = async (adminUser: AdminUser) => {
    if (!confirm(`Remove administrator "${adminUser.email}"?`)) return;
    try {
      const removeAdmin = httpsCallable(functions, 'deleteAdminUser');
      await removeAdmin({ uid: adminUser.uid });
      loadAdmins();
    } catch (error) {
      console.error('Error deleting admin:', error);
      alert(error instanceof Error ? error.message : 'Failed to remove administrator');
    }
  };

  if (!authenticated) return null;

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '0.75rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <ShieldAlert size={12} color="#005eb8" /> Admin Dashboard
          </h1>
          <p style={{ color: '#4c6272', margin: '0.05rem 0 0', fontSize: '0.65rem' }}>Manage registered practices</p>
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

      {adminActionLink && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Administrator Link Ready</h2>
          <p style={{ color: '#4c6272', marginBottom: '1rem' }}>{adminActionMessage}</p>
          <textarea
            readOnly
            value={adminActionLink}
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #d8dde0',
              borderRadius: '8px',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              onClick={() => navigator.clipboard.writeText(adminActionLink)}
              className="action-button"
              style={{ backgroundColor: '#005eb8' }}
            >
              Copy Link
            </button>
            <button
              onClick={() => {
                setAdminActionLink('');
                setAdminActionMessage('');
              }}
              className="action-button"
              style={{ backgroundColor: '#4c6272' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

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

      {showAddAdminForm && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Add Administrator</h2>
            <button onClick={() => setShowAddAdminForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {addAdminError && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {addAdminError}
            </div>
          )}
          <form onSubmit={addAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Administrator Name</label>
              <input
                type="text" value={newAdminName} onChange={e => setNewAdminName(e.target.value)}
                placeholder="e.g. Jane Smith"
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Administrator Email *</label>
              <input
                type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required
                placeholder="e.g. admin@nhs.net"
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" className="action-button" style={{ alignSelf: 'flex-start' }}>
              <Plus size={16} /> Add Administrator
            </button>
          </form>
        </div>
      )}

      {editingPractice && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #007f3b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Edit Practice</h2>
            <button onClick={() => setEditingPractice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {editError && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {editError}
            </div>
          )}
          <form onSubmit={savePracticeEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Organisation Name *</label>
              <input
                type="text" value={editName} onChange={e => setEditName(e.target.value)} required
                placeholder="Exact name as in SystmOne"
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>ODS Code</label>
                <input
                  type="text" value={editOds} onChange={e => setEditOds(e.target.value)}
                  placeholder="e.g. C84001"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Contact Email *</label>
                <input
                  type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required
                  placeholder="e.g. admin@nhs.net"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start' }}>
              <button type="submit" className="action-button" style={{ backgroundColor: '#007f3b' }}>
                Save Changes
              </button>
              <button type="button" onClick={() => setEditingPractice(null)} className="action-button" style={{ backgroundColor: '#4c6272' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #007f3b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Edit Administrator</h2>
            <button onClick={() => setEditingAdmin(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {editAdminError && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {editAdminError}
            </div>
          )}
          <form onSubmit={saveAdminEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Administrator Name *</label>
              <input
                type="text" value={editAdminName} onChange={e => setEditAdminName(e.target.value)} required
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Administrator Email *</label>
              <input
                type="email" value={editAdminEmail} onChange={e => setEditAdminEmail(e.target.value)} required
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={editAdminActive}
                onChange={e => setEditAdminActive(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Administrator account active
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start' }}>
              <button type="submit" className="action-button" style={{ backgroundColor: '#007f3b' }}>
                Save Changes
              </button>
              <button type="button" onClick={() => setEditingAdmin(null)} className="action-button" style={{ backgroundColor: '#4c6272' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
            Administrator Accounts ({adminUsers.length})
          </h2>
          {!showAddAdminForm && (
            <button onClick={() => setShowAddAdminForm(true)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Plus size={16} /> Add Administrator
            </button>
          )}
        </div>

        {loadingAdmins ? (
          <p style={{ color: '#4c6272' }}>Loading administrators...</p>
        ) : adminUsers.length === 0 ? (
          <p style={{ color: '#4c6272' }}>No administrator accounts found yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {adminUsers.map((adminUser) => (
              <div
                key={adminUser.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: '#f8fafb',
                  borderRadius: '8px',
                  border: '1px solid #d8dde0',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{adminUser.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#4c6272', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                    <span>{adminUser.email}</span>
                    <span style={{
                      padding: '0 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: adminUser.is_active ? '#e8f5e9' : '#fde8e8',
                      color: adminUser.is_active ? '#007f3b' : '#d5281b',
                    }}>
                      {adminUser.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span style={{
                      padding: '0 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: adminUser.role === 'owner' ? '#fff4e5' : '#eef7ff',
                      color: adminUser.role === 'owner' ? '#8a4b00' : '#005eb8',
                    }}>
                      {adminUser.role.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button onClick={() => openAdminEditForm(adminUser)} className="action-button" style={{ backgroundColor: '#4c6272' }}>
                  <Edit2 size={16} /> Edit
                </button>
                <button onClick={() => resetAdminPassword(adminUser)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
                  <RefreshCw size={16} /> Reset Password
                </button>
                {adminUser.role !== 'owner' && (
                  <button onClick={() => deleteAdmin(adminUser)} className="action-button" style={{ backgroundColor: '#d5281b' }}>
                    <Trash2 size={16} /> Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
                    <span>Patient link uses: {practice.link_visit_count ?? 0}</span>
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
                    onClick={() => openEditForm(practice)}
                    style={{
                      padding: '0.4rem 0.75rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '0.8rem', fontWeight: 600,
                      background: '#005eb8', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
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
