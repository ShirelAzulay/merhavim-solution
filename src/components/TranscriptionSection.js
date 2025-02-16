import React, { useState, useEffect } from 'react';
import { 
  Container, 
  SpaceBetween,
  Button,
  Select,
  StatusIndicator,
  Tabs
} from '@cloudscape-design/components';

export default function TranscriptionSection({ 
  patientID,
  availableRecordings = [],
  availableTranscripts = [],
  currentTranscript,
  onTranscribe,
  onTranscriptDelete,
  onTranscriptSelect,
  onTranscriptChange,
  onTranscriptSave,
  isTranscribing,
  isSaving,
  error,
  setError
}) {
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [recordingDurations, setRecordingDurations] = useState({});
  const [fullTranscriptData, setFullTranscriptData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const getDuration = async (url) => {
      return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration);
        });
        audio.addEventListener('error', () => {
          resolve(null);
        });
      });
    };

    const fetchDurations = async () => {
      const durations = {};
      for (const recording of availableRecordings) {
        const duration = await getDuration(recording.url);
        if (duration) {
          durations[recording.url] = duration;
        }
      }
      setRecordingDurations(durations);
    };

    fetchDurations();
  }, [availableRecordings]);

  useEffect(() => {
    console.log('Available transcripts:', availableTranscripts);
  }, [availableTranscripts]);

  useEffect(() => {
    console.log('TranscriptionSection - Available Recordings:', availableRecordings);
  }, [availableRecordings]);

  const recordingOptions = availableRecordings.map(recording => ({
    label: recording.fileName,
    value: recording.url,
    description: `${new Date(recording.lastModified).toLocaleString()}`
  }));

  const transcriptOptions = availableTranscripts.map(transcript => ({
    label: transcript.fileName.replace('output/transcribe/', '').replace('.json', ''),
    value: transcript.url,
    description: new Date(transcript.lastModified).toLocaleString()
  }));

  const handleTranscriptChange = (newText) => {
    if (fullTranscriptData) {
      const updatedData = {
        ...fullTranscriptData,
        results: {
          ...fullTranscriptData.results,
          transcripts: [{ transcript: newText }]
        }
      };
      setFullTranscriptData(updatedData);
      setHasChanges(true);
    }
    onTranscriptChange?.(newText);
  };

  const handleSave = () => {
    if (fullTranscriptData && selectedTranscript) {
      // Split the current transcript into segments
      const segments = currentTranscript.split('\n').map(line => {
        const [speaker, text] = line.split(': ');
        return {
          speaker_label: speaker === 'דובר 1' ? 'spk_0' : 'spk_1',
          transcript: text
        };
      });

      const updatedData = {
        ...fullTranscriptData,
        results: {
          ...fullTranscriptData.results,
          transcripts: [{
            transcript: segments.map(s => s.transcript).join(' ')
          }],
          audio_segments: segments.map((segment, index) => ({
            ...fullTranscriptData.results.audio_segments[index],
            speaker_label: segment.speaker_label,
            transcript: segment.transcript
          }))
        }
      };
      
      onTranscriptSave(selectedTranscript.label, updatedData);
      setHasChanges(false);
    }
  };

  const handleDelete = async (transcriptLabel) => {
    setIsDeleting(true);
    try {
      await onTranscriptDelete(transcriptLabel);
      if (selectedTranscript?.label === transcriptLabel) {
        setFullTranscriptData(null);
        onTranscriptSelect('');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTranscriptSelection = async (option) => {
    try {
      const response = await fetch(option.value);
      if (response.ok) {
        const data = await response.json();
        setFullTranscriptData(data);
        
        // Format the transcript into turns using audio_segments
        const formattedTranscript = data.results.audio_segments
          .map(segment => {
            const speaker = segment.speaker_label === 'spk_0' ? 'דובר 1' : 'דובר 2';
            return `${speaker}: ${segment.transcript}`;
          })
          .join('\n');

        onTranscriptSelect(formattedTranscript);
      }
    } catch (error) {
      console.error('Error loading transcript:', error);
      setError?.('שגיאה בטעינת התמלול');
    }
  };

  return (
    <SpaceBetween direction="vertical" size="m">
      <Tabs
        tabs={[
          {
            label: "הקלטות",
            id: "recordings",
            content: (
              <SpaceBetween direction="vertical" size="m">
                <Select
                  selectedOption={selectedRecording}
                  onChange={({ detail }) => setSelectedRecording(detail.selectedOption)}
                  options={recordingOptions}
                  placeholder="בחר הקלטה לתמלול"
                  empty="לא נמצאו הקלטות זמינות"
                />

                {selectedRecording && (
                  <Button 
                    variant="primary"
                    onClick={() => onTranscribe(selectedRecording.label)}
                    disabled={isTranscribing}
                    loading={isTranscribing}
                  >
                    {isTranscribing ? 'מתמלל...' : 'תמלל שיחה'}
                  </Button>
                )}
              </SpaceBetween>
            )
          },
          {
            label: "תמלולים קיימים",
            id: "transcripts",
            content: (
              <Select
                selectedOption={selectedTranscript}
                onChange={({ detail }) => {
                  console.log('Selected transcript:', detail.selectedOption);
                  setSelectedTranscript(detail.selectedOption);
                  handleTranscriptSelection(detail.selectedOption);
                }}
                options={transcriptOptions}
                placeholder="בחר תמלול"
                empty="לא נמצאו תמלולים"
              />
            )
          }
        ]}
      />

      {error && (
        <StatusIndicator type={typeof error === 'object' ? error.type : 'error'}>
          {typeof error === 'object' ? error.message : error}
        </StatusIndicator>
      )}

      {currentTranscript && (
        <Container header={
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <h3>תמלול</h3>
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="primary"
                onClick={handleSave}
                disabled={isSaving || !hasChanges || !selectedTranscript}
                loading={isSaving}
              >
                שמור תמלול
              </Button>
              <Button
                variant="link"
                onClick={() => handleDelete(selectedTranscript?.label)}
                disabled={isDeleting}
                loading={isDeleting}
              >
                מחק תמלול
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        }>
          <textarea
            value={currentTranscript}
            onChange={(e) => handleTranscriptChange(e.target.value)}
            style={{ 
              width: '100%',
              minHeight: '300px',
              padding: '10px',
              backgroundColor: '#f8f8f8',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontFamily: 'Arial, sans-serif',
              fontSize: '14px',
              direction: 'rtl',  // RTL for Hebrew
              resize: 'vertical',
              lineHeight: '1.5'
            }}
          />
        </Container>
      )}
    </SpaceBetween>
  );
} 