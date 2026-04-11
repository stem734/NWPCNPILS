import React, { useMemo, useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, CheckCircle, XCircle, Trash2, RefreshCw, Plus, X, FlaskConical, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

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
  patient_rating_count?: number;
  patient_rating_total?: number;
}

interface AdminUser {
  uid: string;
  email: string;
  name: string;
  is_active: boolean;
  role: 'owner' | 'admin';
}

interface AuditLog {
  id: string;
  action: 'created' | 'updated' | 'deleted';
  actorUid: string;
  code: string;
  timestampMs: number;
  previous_state: any;
  new_state: any;
}

interface LoginAuditEntry {
  id: string;
  uid: string;
  email: string;
  actorType: 'admin' | 'practice';
  actorName: string;
  actorId?: string | null;
  adminRole?: 'owner' | 'admin' | null;
  portal: 'admin' | 'practice';
  userAgent: string;
  ipAddress: string;
  createdAtMs: number;
}

interface LoginAuditGroup {
  key: string;
  actorName: string;
  email: string;
  actorType: 'admin' | 'practice';
  portal: 'admin' | 'practice';
  adminRole?: 'owner' | 'admin' | null;
  actorId?: string | null;
  latestCreatedAtMs: number;
  latestIpAddress: string;
  latestUserAgent: string;
  entries: LoginAuditEntry[];
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'practices' | 'admins' | 'setup' | 'audit'>('practices');
  const [auditTab, setAuditTab] = useState<'login' | 'medication'>('login');
  const [practices, setPractices] = useState<Practice[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginAudit, setLoginAudit] = useState<LoginAuditEntry[]>([]);
  const [practiceSearch, setPracticeSearch] = useState('');
  const [practiceStatusFilter, setPracticeStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [loadingLoginAudit, setLoadingLoginAudit] = useState(true);
  const [expandedLoginAudit, setExpandedLoginAudit] = useState<Record<string, boolean>>({});
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
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDangerous: boolean;
    onConfirm: () => void;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
        loadPractices();
        loadAdmins();
        loadAudits();
        loadLoginAudit();
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

  const loadAudits = async () => {
    setLoadingAudits(true);
    try {
      const listAudits = httpsCallable(functions, 'listMedicationAudits');
      const result = await listAudits();
      const data = result.data as { audits: AuditLog[] };
      setAuditLogs(data.audits || []);
    } catch (error) {
      console.error('Error loading audits:', error);
    }
    setLoadingAudits(false);
  };

  const loadLoginAudit = async () => {
    setLoadingLoginAudit(true);
    try {
      const listLoginAudit = httpsCallable(functions, 'listLoginAudit');
      const result = await listLoginAudit();
      const data = result.data as { entries: LoginAuditEntry[] };
      setLoginAudit(data.entries || []);
    } catch (error) {
      console.error('Error loading login audit:', error);
    }
    setLoadingLoginAudit(false);
  };

  const groupedLoginAudit = useMemo<LoginAuditGroup[]>(() => {
    const groups = new Map<string, LoginAuditGroup>();

    loginAudit.forEach((entry) => {
      const groupKey = `${entry.actorType}:${entry.portal}:${entry.email || entry.uid}`;
      const existing = groups.get(groupKey);

      if (existing) {
        existing.entries.push(entry);
        if (entry.createdAtMs > existing.latestCreatedAtMs) {
          existing.latestCreatedAtMs = entry.createdAtMs;
          existing.latestIpAddress = entry.ipAddress;
          existing.latestUserAgent = entry.userAgent;
        }
        return;
      }

      groups.set(groupKey, {
        key: groupKey,
        actorName: entry.actorName,
        email: entry.email,
        actorType: entry.actorType,
        portal: entry.portal,
        adminRole: entry.adminRole,
        actorId: entry.actorId,
        latestCreatedAtMs: entry.createdAtMs,
        latestIpAddress: entry.ipAddress,
        latestUserAgent: entry.userAgent,
        entries: [entry],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((left, right) => right.createdAtMs - left.createdAtMs),
      }))
      .sort((left, right) => right.latestCreatedAtMs - left.latestCreatedAtMs);
  }, [loginAudit]);

  const toggleLoginAuditGroup = (key: string) => {
    setExpandedLoginAudit((current) => ({
      ...current,
      [key]: !current[key],
    }));
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

  const deletePractice = (practice: Practice) => {
    setConfirmDialog({
      title: 'Remove Practice',
      message: `Are you sure you want to remove "${practice.name}"? This action cannot be undone.`,
      confirmLabel: 'Remove',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'practices', practice.id));
          loadPractices();
        } catch (error) {
          console.error('Error deleting practice:', error);
        }
        setConfirmDialog(null);
      },
    });
  };

  const resetPracticeCounters = (practice: Practice) => {
    setConfirmDialog({
      title: 'Reset Practice Counters',
      message: `Reset patient link usage and satisfaction scores for "${practice.name}"? This will clear usage count, rating count, rating total, and last accessed date.`,
      confirmLabel: 'Reset Counters',
      isDangerous: true,
      onConfirm: async () => {
        try {
          const resetCounters = httpsCallable(functions, 'resetPracticeCounters');
          await resetCounters({ practiceId: practice.id });
          loadPractices();
        } catch (error) {
          console.error('Error resetting counters:', error);
        }
        setConfirmDialog(null);
      },
    });
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

  const deleteAdmin = (adminUser: AdminUser) => {
    setConfirmDialog({
      title: 'Remove Administrator',
      message: `Remove administrator "${adminUser.email}"? This action cannot be undone.`,
      confirmLabel: 'Remove',
      isDangerous: true,
      onConfirm: async () => {
        try {
          const removeAdmin = httpsCallable(functions, 'deleteAdminUser');
          await removeAdmin({ uid: adminUser.uid });
          loadAdmins();
        } catch (error) {
          console.error('Error deleting admin:', error);
          alert(error instanceof Error ? error.message : 'Failed to remove administrator');
        }
        setConfirmDialog(null);
      },
    });
  };

  if (!authenticated) return null;

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
      <div className="dashboard-header">
        <div className="dashboard-header-copy">
          <h1>
            <ShieldAlert size={22} color="#005eb8" /> Admin Dashboard
          </h1>
          <p>Manage practices, administrators, and setup links from one place.</p>
        </div>
        <div className="dashboard-actions">
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

      <div className="dashboard-tabs">
        <button className={`dashboard-tab${activeTab === 'practices' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('practices')}>
          Practices
        </button>
        <button className={`dashboard-tab${activeTab === 'admins' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('admins')}>
          Administrators
        </button>
        <button className={`dashboard-tab${activeTab === 'setup' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('setup')}>
          Setup
        </button>
        <button className={`dashboard-tab${activeTab === 'audit' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('audit')}>
          Audit Log
        </button>
      </div>

      {adminActionLink && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <h2 className="dashboard-panel-title">Administrator Link Ready</h2>
          <p className="dashboard-panel-subtitle" style={{ marginBottom: '1rem' }}>{adminActionMessage}</p>
          <textarea
            readOnly
            value={adminActionLink}
            rows={4}
            style={{ width: '100%', resize: 'vertical' }}
            className="dashboard-field"
          />
          <div className="dashboard-inline-actions" style={{ marginTop: '1rem' }}>
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

      {showAddForm && activeTab === 'practices' && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">Add Practice</h2>
            <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {addError && (
            <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
              {addError}
            </div>
          )}
          <form onSubmit={addPractice} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="dashboard-field">
              <label>Organisation Name *</label>
              <input
                type="text" value={newName} onChange={e => setNewName(e.target.value)} required
                placeholder="Exact name as in SystmOne"
              />
            </div>
            <div className="dashboard-form-grid">
              <div className="dashboard-field">
                <label>ODS Code</label>
                <input
                  type="text" value={newOds} onChange={e => setNewOds(e.target.value)}
                  placeholder="e.g. C84001"
                />
              </div>
              <div className="dashboard-field">
                <label>Contact Email *</label>
                <input
                  type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                  placeholder="e.g. admin@nhs.net"
                />
              </div>
            </div>
            <button type="submit" className="action-button" style={{ alignSelf: 'flex-start' }}>
              <Plus size={16} /> Add & Activate Practice
            </button>
          </form>
        </div>
      )}

      {showAddAdminForm && activeTab === 'admins' && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">Add Administrator</h2>
            <button onClick={() => setShowAddAdminForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {addAdminError && (
            <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
              {addAdminError}
            </div>
          )}
          <form onSubmit={addAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="dashboard-field">
              <label>Administrator Name</label>
              <input
                type="text" value={newAdminName} onChange={e => setNewAdminName(e.target.value)}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div className="dashboard-field">
              <label>Administrator Email *</label>
              <input
                type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required
                placeholder="e.g. admin@nhs.net"
              />
            </div>
            <button type="submit" className="action-button" style={{ alignSelf: 'flex-start' }}>
              <Plus size={16} /> Add Administrator
            </button>
          </form>
        </div>
      )}

      {editingPractice && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #007f3b' }}>
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">Edit Practice</h2>
            <button onClick={() => setEditingPractice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {editError && (
            <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
              {editError}
            </div>
          )}
          <form onSubmit={savePracticeEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="dashboard-field">
              <label>Organisation Name *</label>
              <input
                type="text" value={editName} onChange={e => setEditName(e.target.value)} required
                placeholder="Exact name as in SystmOne"
              />
            </div>
            <div className="dashboard-form-grid">
              <div className="dashboard-field">
                <label>ODS Code</label>
                <input
                  type="text" value={editOds} onChange={e => setEditOds(e.target.value)}
                  placeholder="e.g. C84001"
                />
              </div>
              <div className="dashboard-field">
                <label>Contact Email *</label>
                <input
                  type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required
                  placeholder="e.g. admin@nhs.net"
                />
              </div>
            </div>
            <div className="dashboard-inline-actions" style={{ alignSelf: 'flex-start' }}>
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
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #007f3b' }}>
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">Edit Administrator</h2>
            <button onClick={() => setEditingAdmin(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {editAdminError && (
            <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
              {editAdminError}
            </div>
          )}
          <form onSubmit={saveAdminEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="dashboard-field">
              <label>Administrator Name *</label>
              <input
                type="text" value={editAdminName} onChange={e => setEditAdminName(e.target.value)} required
              />
            </div>
            <div className="dashboard-field">
              <label>Administrator Email *</label>
              <input
                type="email" value={editAdminEmail} onChange={e => setEditAdminEmail(e.target.value)} required
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
            <div className="dashboard-inline-actions" style={{ alignSelf: 'flex-start' }}>
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

      {activeTab === 'admins' && (
      <div className="dashboard-panel dashboard-section">
        <div className="dashboard-panel-header">
          <div>
            <h2 className="dashboard-panel-title">
            Administrator Accounts ({adminUsers.length})
            </h2>
            <p className="dashboard-panel-subtitle">Manage who can administer the platform and generate manual setup or reset links.</p>
          </div>
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
          <div className="dashboard-list">
            {adminUsers.map((adminUser) => (
              <div
                key={adminUser.uid}
                className="dashboard-list-card"
              >
                <div className="dashboard-list-main">
                  <div className="dashboard-list-title">{adminUser.name}</div>
                  <div className="dashboard-meta">
                    <span>{adminUser.email}</span>
                    <span className={`dashboard-badge ${adminUser.is_active ? 'dashboard-badge--green' : 'dashboard-badge--red'}`}>
                      {adminUser.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span className={`dashboard-badge ${adminUser.role === 'owner' ? 'dashboard-badge--amber' : 'dashboard-badge--blue'}`}>
                      {adminUser.role.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="dashboard-list-actions">
                  <button onClick={() => openAdminEditForm(adminUser)} className="dashboard-pill-button dashboard-pill-button--muted">
                    <Edit2 size={16} /> Edit
                  </button>
                  <button onClick={() => resetAdminPassword(adminUser)} className="dashboard-pill-button dashboard-pill-button--primary">
                    <RefreshCw size={16} /> Reset Password
                  </button>
                  {adminUser.role !== 'owner' && (
                    <button onClick={() => deleteAdmin(adminUser)} className="dashboard-pill-button dashboard-pill-button--danger">
                      <Trash2 size={16} /> Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {activeTab === 'practices' && (
      <div className="dashboard-panel dashboard-section">
        <div className="dashboard-panel-header">
          <div>
            <h2 className="dashboard-panel-title">
            Registered Practices ({practices.length})
            </h2>
            <p className="dashboard-panel-subtitle">Control which practices can use the service and keep their setup details up to date.</p>
          </div>
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
          <>
            <div className="dashboard-toolbar" style={{ marginBottom: '1rem' }}>
              <div className="dashboard-search">
                <input
                  type="text"
                  value={practiceSearch}
                  onChange={(e) => setPracticeSearch(e.target.value)}
                  placeholder="Search by name, ODS code, or email"
                  style={{ width: '100%', padding: '0.75rem 0.9rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div className="dashboard-chip-row">
                <button
                  className={`dashboard-chip${practiceStatusFilter === 'all' ? ' dashboard-chip--active' : ''}`}
                  onClick={() => setPracticeStatusFilter('all')}
                >
                  All
                </button>
                <button
                  className={`dashboard-chip${practiceStatusFilter === 'active' ? ' dashboard-chip--active' : ''}`}
                  onClick={() => setPracticeStatusFilter('active')}
                >
                  Active
                </button>
                <button
                  className={`dashboard-chip${practiceStatusFilter === 'inactive' ? ' dashboard-chip--active' : ''}`}
                  onClick={() => setPracticeStatusFilter('inactive')}
                >
                  Inactive
                </button>
              </div>
            </div>
            <div className="dashboard-list">
              {practices
                .filter(p => {
                  const matchesSearch = practiceSearch === '' || [p.name, p.ods_code || '', p.contact_email || ''].some(field =>
                    field.toLowerCase().includes(practiceSearch.toLowerCase())
                  );
                  const matchesStatus = practiceStatusFilter === 'all' || (practiceStatusFilter === 'active' ? p.is_active : !p.is_active);
                  return matchesSearch && matchesStatus;
                })
                .map(practice => (
              <div
                key={practice.id}
                className="dashboard-list-card"
                style={{ background: practice.is_active ? '#f0f9f0' : '#fef7f0' }}
              >
                <div className="dashboard-list-main">
                  <div className="dashboard-list-title">{practice.name}</div>
                  <div className="dashboard-meta">
                    {practice.ods_code && <span>ODS: {practice.ods_code}</span>}
                    {practice.contact_email && <span>{practice.contact_email}</span>}
                    <span>Patient link uses: {practice.link_visit_count ?? 0}</span>
                    <span>
                      Satisfaction: {practice.patient_rating_count && practice.patient_rating_count > 0
                        ? `${((practice.patient_rating_total ?? 0) / practice.patient_rating_count).toFixed(1)}/5 (${practice.patient_rating_count})`
                        : 'No ratings'}
                    </span>
                    {practice.last_accessed && (
                      <span>Last active: {practice.last_accessed.toDate?.().toLocaleDateString() || 'N/A'}</span>
                    )}
                  </div>
                </div>
                <div className="dashboard-list-actions">
                  {practice.is_active ? (
                    <span className="dashboard-badge dashboard-badge--green">
                      <CheckCircle size={16} /> Active
                    </span>
                  ) : (
                    <span className="dashboard-badge dashboard-badge--red">
                      <XCircle size={16} /> Inactive
                    </span>
                  )}
                  <button onClick={() => openEditForm(practice)} className="dashboard-pill-button dashboard-pill-button--primary">
                    <Edit2 size={14} /> Edit
                  </button>
                  <button onClick={() => toggleActive(practice)} className={`dashboard-pill-button ${practice.is_active ? 'dashboard-pill-button--danger' : 'dashboard-pill-button--success'}`}>
                    {practice.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => resetPracticeCounters(practice)} className="dashboard-pill-button dashboard-pill-button--muted">
                    <RefreshCw size={14} /> Reset Counters
                  </button>
                  <button onClick={() => deletePractice(practice)} className="dashboard-pill-button dashboard-pill-button--muted">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
        )}
      </div>
      )}

      {activeTab === 'setup' && (
      <div className="dashboard-panel dashboard-section">
        <h2 className="dashboard-panel-title">Practice Sign-up Link</h2>
        <p className="dashboard-panel-subtitle" style={{ marginBottom: '1rem' }}>
          Share this link with practices that want to register:
        </p>
        <div style={{
          padding: '0.75rem 1rem', background: '#eef7ff', borderRadius: '8px',
          fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all',
          border: '1px solid #005eb8'
        }}>
          {window.location.origin}/signup
        </div>
        <div className="dashboard-banner dashboard-banner--info" style={{ marginTop: '1rem' }}>
          Use the Administrators tab to create manual setup or reset links after accounts are created.
        </div>
      </div>
      )}

      {activeTab === 'audit' && (
      <>
        <div className="dashboard-tabs" style={{ marginBottom: '1rem' }}>
          <button
            className={`dashboard-tab${auditTab === 'login' ? ' dashboard-tab--active' : ''}`}
            onClick={() => setAuditTab('login')}
          >
            Login Audit
          </button>
          <button
            className={`dashboard-tab${auditTab === 'medication' ? ' dashboard-tab--active' : ''}`}
            onClick={() => setAuditTab('medication')}
          >
            Medication Audit
          </button>
        </div>

        {auditTab === 'login' && (
        <div className="dashboard-panel dashboard-section">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">
              Recent Login Audit ({groupedLoginAudit.length})
              </h2>
              <p className="dashboard-panel-subtitle">Successful sign-ins grouped by user so repeated logins stay tidy.</p>
            </div>
            <button onClick={loadLoginAudit} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              <RefreshCw size={16} /> Refresh Logins
            </button>
          </div>

          <div className="dashboard-banner dashboard-banner--info" style={{ marginBottom: '1rem' }}>
            Failed sign-in attempts are not captured here because the password check is handled directly by Firebase Auth.
          </div>

          {loadingLoginAudit ? (
            <p style={{ color: '#4c6272' }}>Loading login audit...</p>
          ) : groupedLoginAudit.length === 0 ? (
            <p style={{ color: '#4c6272' }}>No successful sign-ins recorded yet.</p>
          ) : (
            <div className="dashboard-list" style={{ marginBottom: '1rem' }}>
              {groupedLoginAudit.map((group) => {
                const isExpanded = Boolean(expandedLoginAudit[group.key]);

                return (
                  <div key={group.key} className="dashboard-list-card">
                    <div className="dashboard-list-main">
                      <div className="dashboard-panel-header" style={{ gap: '1rem', alignItems: 'flex-start' }}>
                        <div>
                          <div className="dashboard-list-title">{group.actorName}</div>
                          <div className="dashboard-meta">
                            <span>{group.email}</span>
                            <span className={`dashboard-badge ${group.actorType === 'admin' ? 'dashboard-badge--blue' : 'dashboard-badge--green'}`}>
                              {group.actorType.toUpperCase()}
                            </span>
                            <span className="dashboard-badge dashboard-badge--amber">{group.portal.toUpperCase()} PORTAL</span>
                            {group.adminRole && (
                              <span className="dashboard-badge dashboard-badge--muted">{group.adminRole.toUpperCase()}</span>
                            )}
                            <span>{group.entries.length} login{group.entries.length === 1 ? '' : 's'}</span>
                            <span>Last: {new Date(group.latestCreatedAtMs).toLocaleString('en-GB')}</span>
                          </div>
                          <div className="dashboard-meta" style={{ marginTop: '0.35rem' }}>
                            <span>Latest IP: {group.latestIpAddress || 'Unavailable'}</span>
                            <span title={group.latestUserAgent}>Latest browser: {group.latestUserAgent ? group.latestUserAgent.slice(0, 90) : 'Unavailable'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleLoginAuditGroup(group.key)}
                          className="dashboard-pill-button dashboard-pill-button--muted"
                          style={{ flexShrink: 0 }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          {isExpanded ? 'Hide history' : 'View history'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="dashboard-audit-history">
                          {group.entries.map((entry, index) => (
                            <div key={entry.id} className="dashboard-audit-history-row">
                              <div className="dashboard-meta" style={{ margin: 0 }}>
                                <span>{index === 0 ? 'Latest login' : `Previous login ${index}`}</span>
                                <span>{new Date(entry.createdAtMs).toLocaleString('en-GB')}</span>
                                <span>IP: {entry.ipAddress || 'Unavailable'}</span>
                              </div>
                              <div className="dashboard-meta" style={{ marginTop: '0.25rem' }}>
                                <span title={entry.userAgent}>Browser: {entry.userAgent || 'Unavailable'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {auditTab === 'medication' && (
        <div className="dashboard-panel dashboard-section">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">
              Medication Audit Log ({auditLogs.length})
              </h2>
              <p className="dashboard-panel-subtitle">History of changes to medication cards.</p>
            </div>
            <button onClick={loadAudits} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loadingAudits ? (
            <p style={{ color: '#4c6272' }}>Loading audit logs...</p>
          ) : auditLogs.length === 0 ? (
            <p style={{ color: '#4c6272' }}>No audit history found.</p>
          ) : (
            <div className="dashboard-list">
              {auditLogs.map((audit) => {
                const actorEmail = adminUsers.find(a => a.uid === audit.actorUid)?.email || audit.actorUid;
                const dateObj = new Date(audit.timestampMs);
                const isDeleted = audit.action === 'deleted';
                const isCreated = audit.action === 'created';
                const title = audit.new_state?.title || audit.previous_state?.title || 'Unknown Card';

                return (
                <div
                  key={audit.id}
                  className="dashboard-list-card"
                >
                  <div style={{
                    padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem',
                    fontWeight: 800, fontFamily: 'monospace', background: isDeleted ? '#d5281b' : (isCreated ? '#007f3b' : '#005eb8'), color: 'white',
                    minWidth: '40px', textAlign: 'center',
                  }}>
                    {audit.code || '???'}
                  </div>
                  <div className="dashboard-list-main" style={{ marginLeft: '1rem' }}>
                    <div className="dashboard-list-title">{title}</div>
                    <div className="dashboard-meta" style={{ marginTop: '0.25rem' }}>
                      <span style={{
                        fontWeight: 700,
                        color: isDeleted ? '#d5281b' : (isCreated ? '#007f3b' : '#005eb8')
                      }}>
                        {audit.action.toUpperCase()}
                      </span>
                      <span>by {actorEmail}</span>
                      <span>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
        )}
      </>
      )}
    </div>
    </>
  );
};

export default AdminDashboard;
