import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { X, User, Lock, Save, Camera, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api';
import './ProfileManager.css';

interface ProfileManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  
  // Profile state
  const [username, setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // We fetch the fresh profile to ensure we have the has_password flag 
  // from the backend, regardless of stale localStorage
  const [freshHasPassword, setFreshHasPassword] = useState<boolean | undefined>(user?.has_password);

  useEffect(() => {
    if (isOpen) {
      setUsername(user?.username || '');
      setAvatar(user?.avatar || '');
      setFreshHasPassword(user?.has_password);
      
      api.get('/auth/profile/')
        .then(res => {
          setFreshHasPassword(res.data.has_password);
          updateUser(res.data);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isGoogleAuth = freshHasPassword === false || !!user?.avatar?.includes('googleusercontent');

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);
    try {
      const res = await api.patch('/auth/profile/', { username, avatar });
      updateUser({ username: res.data.username, avatar: res.data.avatar });
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update profile.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdMsg(null);
    try {
      await api.post('/auth/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        new_password2: newPassword2,
      });
      setPwdMsg({ type: 'success', text: 'Password changed successfully!' });
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
      setTimeout(() => setPwdMsg(null), 3000);
    } catch (err: any) {
      const errors = err.response?.data || {};
      const errorText = Object.values(errors).flat().join(' ') || 'Failed to change password.';
      setPwdMsg({ type: 'error', text: errorText });
    } finally {
      setPwdLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        className="pm-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="pm-modal"
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pm-header">
            <h2>Profile Settings</h2>
            <button className="pm-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="pm-tabs">
            <button
              className={`pm-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={16} />
              <span>General</span>
            </button>
            <button
              className={`pm-tab ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              <Lock size={16} />
              <span>Security</span>
            </button>
          </div>

          <div className="pm-content">
            {activeTab === 'profile' ? (
              <motion.form
                key="profile"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleProfileSubmit}
              >
                <div className="pm-avatar-section">
                  <div className="pm-avatar-wrap">
                    <img src={avatar || 'https://i.pravatar.cc/150?img=11'} alt="Avatar" />
                    {!isGoogleAuth && (
                      <label className="pm-avatar-edit">
                        <Camera size={14} />
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (ev.target?.result) {
                                  setAvatar(ev.target.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <div className="pm-avatar-info">
                    <h4>Profile Picture</h4>
                    <p>{isGoogleAuth ? 'Your avatar is managed by Google.' : 'Click the camera icon to upload a new picture, or paste an image URL below.'}</p>
                  </div>
                </div>

                <div className="pm-field">
                  <label>Avatar URL</label>
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://..."
                    disabled={isGoogleAuth}
                    className={isGoogleAuth ? "pm-input-disabled" : ""}
                  />
                </div>

                <div className="pm-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="pm-input-disabled"
                  />
                  <span className="pm-hint">{isGoogleAuth ? "Managed by Google. Your email cannot be changed." : "Your email address cannot be changed."}</span>
                </div>

                <div className="pm-field">
                  <label>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                {profileMsg && (
                  <div className={`pm-msg pm-msg-${profileMsg.type}`}>
                    {profileMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{profileMsg.text}</span>
                  </div>
                )}

                <div className="pm-actions">
                  <button type="button" className="pm-btn-cancel" onClick={onClose}>
                    Cancel
                  </button>
                  <button type="submit" className="pm-btn-save" disabled={profileLoading}>
                    {profileLoading ? <div className="pm-spinner" /> : <Save size={16} />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="password"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handlePasswordSubmit}
              >
                {isGoogleAuth ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <AlertCircle size={48} color="var(--text-3)" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-1)' }}>Google Account</h3>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      Your account is linked to Google. Password management and security settings are handled by your Google account.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="pm-field">
                      <label>Current Password</label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                      />
                    </div>

                    <div className="pm-field">
                      <label>New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>

                    <div className="pm-field">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        value={newPassword2}
                        onChange={(e) => setNewPassword2(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>

                    {pwdMsg && (
                      <div className={`pm-msg pm-msg-${pwdMsg.type}`}>
                        {pwdMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>{pwdMsg.text}</span>
                      </div>
                    )}

                    <div className="pm-actions">
                      <button type="button" className="pm-btn-cancel" onClick={onClose}>
                        Cancel
                      </button>
                      <button type="submit" className="pm-btn-save" disabled={pwdLoading}>
                        {pwdLoading ? <div className="pm-spinner" /> : <Save size={16} />}
                        <span>Update Password</span>
                      </button>
                    </div>
                  </>
                )}
              </motion.form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default ProfileManager;
