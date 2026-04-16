import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildDemoPatientUrl, getRandomDemoVariation } from '../demoHelpers';

const Demo: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const variation = getRandomDemoVariation();
    navigate(`${buildDemoPatientUrl(variation)}&demo=1`, { replace: true });
  }, [navigate]);

  return (
    <div className="card patient-state-card" style={{ textAlign: 'center' }}>
      <h1>Loading demo...</h1>
      <p>Preparing a sample patient view.</p>
    </div>
  );
};

export default Demo;
