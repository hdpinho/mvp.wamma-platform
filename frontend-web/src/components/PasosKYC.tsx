import React from 'react';

interface PasosKYCProps {
  currentStep: number; // 1, 2, or 3
}

export const PasosKYC: React.FC<PasosKYCProps> = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Datos Básicos' },
    { num: 2, label: 'Cédula & RIF (OCR)' },
    { num: 3, label: 'Reconocimiento Facial' },
  ];

  return (
    <div className="stepper" style={{ margin: '20px 0' }}>
      {steps.map((step) => {
        let statusClass = '';
        if (currentStep > step.num) statusClass = 'completed';
        else if (currentStep === step.num) statusClass = 'active';

        return (
          <div key={step.num} className={`step ${statusClass}`} style={{ flex: 1 }}>
            <div className="step-number">
              {currentStep > step.num ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step.num
              )}
            </div>
            <div className="step-label" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
