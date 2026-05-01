import React from 'react';
import Modal from './Modal';
import WarningCallout from './WarningCallout';

type SickDayRulesModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SICK_DAY_RULES = [
  'STOP this medication if you are experiencing vomiting or diarrhoea for more than 24 hours',
  'Whilst not taking your medication try to stay hydrated and eat plain foods until you are feeling better',
  'RESTART your medication once you have been eating and drinking normally for 24-48 hours',
  'Do NOT take extra doses to make up for what you have missed. Restart at your usual dose.',
];

const SickDayRulesModal: React.FC<SickDayRulesModalProps> = ({ isOpen, onClose }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    size="md"
    title="Sick Day Rules"
    closeOnOverlayClick={false}
    footer={
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} className="action-button" style={{ backgroundColor: '#4c6272' }}>
          Close
        </button>
      </div>
    }
  >
    <WarningCallout title="Important">
      <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
        {SICK_DAY_RULES.map((rule) => (
          <li key={rule} style={{ marginBottom: '0.65rem' }}>
            {rule}
          </li>
        ))}
      </ul>
    </WarningCallout>
  </Modal>
);

export default SickDayRulesModal;
