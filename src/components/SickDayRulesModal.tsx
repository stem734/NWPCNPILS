import React from 'react';
import Modal from './Modal';
import WarningCallout from './WarningCallout';

type SickDayRulesModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SICK_DAY_RULES = [
  'Stop this medicine if you have been sick (vomiting) or had diarrhoea for more than 24 hours.',
  'While you are not taking this medicine, try to drink plenty of fluids and eat simple foods until you feel better.',
  'Start taking your medicine again once you have been eating and drinking normally for 24-48 hours.',
  'Do not take extra tablets to make up for missed doses. Restart at your normal dose.',
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
