import React, { useState } from 'react';
import { supabase } from '../supabase';
import { FlaskConical, CheckCircle } from 'lucide-react';
import PracticeForm from '../components/PracticeForm';
import { validatePracticeContactEmail } from '../practiceValidation';

const PracticeSignup: React.FC = () => {
  const [name, setName] = useState('');
  const [odsCode, setOdsCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const emailError = validatePracticeContactEmail(contactEmail);
    if (emailError) {
      setError(emailError);
      setLoading(false);
      return;
    }

    try {

      const { error: insertError } = await supabase.from('practices').insert({
        name: name.trim(),
        ods_code: odsCode.trim().toUpperCase(),
        contact_email: contactEmail.trim(),
        contact_name: contactName.trim(),
        is_active: false, // Requires admin approval
        link_visit_count: 0,
      });
      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err) {
      console.error('Signup error:', err);
      setError('There was a problem submitting your registration. Please try again.');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <CheckCircle size={64} color="var(--nhs-green)" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', color: 'var(--nhs-green)' }}>Registration Submitted</h1>
          <p style={{ color: 'var(--nhs-secondary-text)', marginBottom: '1.5rem' }}>
            Thank you for registering <strong>{name}</strong>.
            Your application is now pending review by the MyMedInfo team.
          </p>
          <div style={{ padding: '1rem', background: 'var(--nhs-blue-tint)', borderRadius: '8px', borderLeft: '4px solid var(--nhs-blue)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              <strong>What happens next?</strong><br />
              We will review your application and activate your practice.
              You will receive confirmation at <strong>{contactEmail}</strong> once approved.
              No changes to your SystmOne protocol are needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <FlaskConical size={48} color="var(--nhs-blue)" style={{ marginBottom: '0.5rem' }} />
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Practice Registration</h1>
          <p style={{ color: 'var(--nhs-secondary-text)' }}>Register your practice for MyMedInfo</p>
        </div>

        <PracticeForm
          values={{ name, odsCode, contactName, contactEmail }}
          error={error}
          loading={loading}
          submitLabel="Register Practice"
          onSubmit={handleSubmit}
          onChange={(field, value) => {
            if (field === 'name') setName(value);
            if (field === 'odsCode') setOdsCode(value);
            if (field === 'contactName') setContactName(value);
            if (field === 'contactEmail') setContactEmail(value);
          }}
          showContactName
        />
      </div>
    </div>
  );
};

export default PracticeSignup;
