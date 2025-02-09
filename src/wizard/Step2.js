import React, { useState, useEffect } from 'react';
import { 
  Container,
  SpaceBetween,
  Button,
  StatusIndicator,
  Textarea
} from '@cloudscape-design/components';
import RecordingControls from '../components/RecordingControls';
import settings from '../settings.json';
import TranscriptionDisplay from '../components/TranscriptionDisplay';
import TranscriptionSection from '../components/TranscriptionSection';

export default function Step2({ 
  patientID,
  recordingUrl,
  existingTranscript,
  onRecordingComplete
}) {
  const [insights, setInsights] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState(existingTranscript);
  const [currentRecording, setCurrentRecording] = useState(recordingUrl);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [availableRecordings, setAvailableRecordings] = useState([]);

  useEffect(() => {
    console.log('Step2 - Transcript changed:', existingTranscript);
  }, [existingTranscript]);

  useEffect(() => {
    setCurrentTranscript(existingTranscript);
    setCurrentRecording(recordingUrl);
  }, [existingTranscript, recordingUrl]);

  useEffect(() => {
    if (patientID) {
      fetchAvailableRecordings();
    }
  }, [patientID]);

  const fetchAvailableRecordings = async () => {
    try {
      const response = await fetch('https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/files?' + 
        new URLSearchParams({
          patientId: patientID,
          fileName: '*.mp4'
        }).toString(), {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.REACT_APP_API_KEY || ''
          }
        });

      if (response.ok) {
        const data = await response.json();
        setAvailableRecordings(data.files || []);
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
      setError('שגיאה בטעינת רשימת ההקלטות');
    }
  };

  const handleAnalyzeTranscription = async () => {
    if (!currentTranscript) {
      setError('אין תמלול זמין לניתוח');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const response = await fetch('https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/bedrock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || ''
        },
        body: JSON.stringify({
          system_instructions: settings.transcription_system_instructions,
          prompt: settings.transcription_prompt + currentTranscript,
          images: [],
          max_tokens: settings.max_tokens || 4096
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze transcription');
      }

      const data = await response.json();
      const parsedResponse = JSON.parse(data.result);
      const textContent = parsedResponse.content[0].text;
      setInsights(textContent);
    } catch (err) {
      console.error('Analysis error:', err);
      setError('שגיאה בניתוח התמלול');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRecordingUpdate = (url) => {
    setCurrentRecording(url);
    onRecordingComplete(url);
  };

  const handleRecordingDelete = () => {
    setCurrentRecording(null);
    onRecordingComplete(null);
  };

  const handleTranscriptChange = (newTranscript) => {
    setCurrentTranscript(newTranscript);
    setInsights('');
  };

  const handleTranscriptDelete = () => {
    setCurrentTranscript('');
    setInsights('');
  };

  const handleTranscribe = (url) => {
    // Implementation of handleTranscribe function
  };

  return (
    <Container 
      header={<h2>הקלטה ותמלול</h2>}
      className="step-container expanded"
    >
      <SpaceBetween direction="vertical" size="l">
        <RecordingControls
          patientID={patientID}
          onRecordingComplete={(url) => {
            handleRecordingUpdate(url);
            fetchAvailableRecordings(); // Refresh the list after new recording
          }}
          initialRecordingUrl={currentRecording}
          onRecordingDelete={handleRecordingDelete}
          onUploadComplete={(id) => {
            fetchAvailableRecordings();
          }}
        />

        <TranscriptionSection
          patientID={patientID}
          availableRecordings={availableRecordings}
          currentTranscript={currentTranscript}
          onTranscribe={handleTranscribe}
          onTranscriptDelete={handleTranscriptDelete}
          isTranscribing={isTranscribing}
          error={error}
        />

        {currentTranscript && currentTranscript.trim() !== '' && (
          <SpaceBetween direction="vertical" size="m">
            <Button
              variant="normal"
              onClick={handleAnalyzeTranscription}
              loading={isAnalyzing}
            >
              הפק תובנות
            </Button>

            {insights && (
              <Container header={<h3>תובנות מהשיחה</h3>}>
                <Textarea
                  value={insights}
                  readOnly
                  rows={10}
                  style={{
                    backgroundColor: '#f8f8f8',
                    lineHeight: '1.5'
                  }}
                />
              </Container>
            )}
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Container>
  );
}