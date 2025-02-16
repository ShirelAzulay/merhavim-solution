// src/wizard/WizardContainer.js
import React, { useState } from 'react';
import Wizard from '@cloudscape-design/components/wizard';
import Step1 from './Step1';
import Step3 from './Step3';

export default function WizardContainer() {
  const [patientID, setPatientID] = useState('');
  const [formData, setFormData] = useState({Ward: '', diagnosis: '', notes: '' });
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isStep1Valid, setIsStep1Valid] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [existingTranscript, setExistingTranscript] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [transcript, setTranscript] = useState('');

  const handleStepChange = ({ detail }) => {
    if (detail.requestedStepIndex > activeStepIndex) {
      if (activeStepIndex === 0 && !isStep1Valid) {
        return;
      }
    } else if (detail.requestedStepIndex === 0) {
      // When going back to Step1, force a check of existing files
      if (patientID) {
        // Force component remount and check files
        setActiveStepIndex(detail.requestedStepIndex);
        setTimeout(() => {
          const currentId = patientID;
          setPatientID('');
          setTimeout(() => {
            setPatientID(currentId);
          }, 50);
        }, 0);
        return;
      }
    }
    setActiveStepIndex(detail.requestedStepIndex);
  };

  const handleExistingMedia = (url, transcript, pdfUrl) => {
    console.log('WizardContainer - handleExistingMedia:', { url, transcript });
    setRecordingUrl(url);
    setExistingTranscript(transcript);
    setPdfUrl(pdfUrl);
  };

  const handleRecordingComplete = (url) => {
    setRecordingUrl(url);
    // If we have a new recording, we should also have a transcript
    if (url) {
      setExistingTranscript(''); // Clear initially
    }
  };

  const steps = [
    {
      title: "בחירת מטופל והעלאת מידע רפואי",
      content: (
        <Step1
          patientID={patientID}
          setPatientID={setPatientID}
          onValidationChange={setIsStep1Valid}
          onExistingMedia={handleExistingMedia}
          activeStepIndex={activeStepIndex}
          onRecordingComplete={handleRecordingComplete}
        />
      ),
      isOptional: false,
    },
    {
      title: "ניתוח קבצי המטופל והכנת דוח מסכם",
      content: (
        <Step3
          patientID={patientID}
          transcript={existingTranscript}
          pdfUrl={pdfUrl}
        />
      ),
      isOptional: false,
    }
  ];


  return (
    <div className="wizard-wrapper">
      <Wizard
        steps={steps}
        activeStepIndex={activeStepIndex}
        onNavigate={handleStepChange}
        i18nStrings={{
          stepNumberLabel: stepNumber =>
            `שלב ${stepNumber}`,
          collapsedStepsLabel: (stepNumber, stepsCount) =>
            `שלב ${stepNumber} מתוך ${stepsCount}`,
          cancelButton: "ביטול",
          previousButton: activeStepIndex === 1 ? "עדכון מידע מקדים" : "בחירת מטופל אחר",
          nextButton: activeStepIndex === 0 ? "הכנת הדוח המסכם" : "הבא",
          submitButton: "סיום",
          optional: "אופציונלי"
        }}
        onSubmit={() => alert('האשף הסתיים!')}
        onCancel={() => alert('האשף בוטל')}
        isLoadingNextStep={activeStepIndex === 0 && !isStep1Valid}
        nextButtonDisabled={activeStepIndex === 0 && !isStep1Valid}
        submitButtonDisabled={true}
      />
    </div>
  );
}
