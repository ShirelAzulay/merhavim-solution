import React, { useState, useRef, useEffect } from 'react';
import { 
  Container, 
  Button, 
  SpaceBetween, 
  Box, 
  StatusIndicator,
  Modal
} from '@cloudscape-design/components';
import recordingPlaceholder from './recording-placeholder.png';
import { uploadRecording, startTranscription } from '../services/transcriptionService';

const RecordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="4" fill="#d91515"/>
  </svg>
);

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="4" y="4" width="8" height="8" fill="#666666"/>
  </svg>
);

export default function RecordingControls({ 
  onRecordingComplete, 
  patientID, 
  initialRecordingUrl,
  onRecordingDelete,
  onUploadComplete
}) {


  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(initialRecordingUrl || null);
  const [duration, setDuration] = useState(0);
  const [isVideo, setIsVideo] = useState(false);
  const [usedFormat, setUsedFormat] = useState(''); // 'mp4' or 'mp3'
  const currentSessionStart = useRef(null);
  const timerInterval = useRef(null);

  const mediaRecorder = useRef(null);
  const videoPreviewRef = useRef(null);
  const playbackRef = useRef(null);
  const streamRef = useRef(null);
  const chunks = useRef([]);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');

  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [existingRecordingUrl, setExistingRecordingUrl] = useState(null);
  const [existingTranscript, setExistingTranscript] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [recordingExistsOnServer, setRecordingExistsOnServer] = useState(Boolean(initialRecordingUrl));

  const [status, setStatus] = useState({ type: null, message: null });

  useEffect(() => {
    if (initialRecordingUrl) {
      setMediaUrl(initialRecordingUrl);
    }
  }, [initialRecordingUrl]);

  useEffect(() => {
    if (mediaUrl && !chunks.current.length) {
      const fetchRecording = async () => {
        try {
          const response = await fetch(mediaUrl);
          const blob = await response.blob();
          chunks.current = [blob];
        } catch (error) {
          console.error('Error fetching recording:', error);
        }
      };
      fetchRecording();
    }
  }, [mediaUrl]);

  useEffect(() => {
    setRecordingExistsOnServer(Boolean(initialRecordingUrl));
  }, [initialRecordingUrl]);

  const getSupportedMimeType = async () => {
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      return 'video/mp4';
    }
    // If MP4 isn't supported, show error instead of falling back to webm
    console.error('MP4 recording not supported in this browser');
    setError('הדפדפן אינו תומך בהקלטת MP4');
    return '';
  };

  const updateTimer = () => {
    if (currentSessionStart.current) {
      const elapsed = (Date.now() - currentSessionStart.current) / 1000;
      setDuration(elapsed);
    }
  };

  const startRecording = async () => {
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
      setMediaUrl(null);
    }
    chunks.current = [];
    setDuration(0);

    try {
      const mimeType = await getSupportedMimeType();
      if (!mimeType) {
        console.error('No supported MIME type found for recording.');
        return;
      }
      setUsedFormat(mimeType.startsWith('video') ? 'mp4' : 'mp3');

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = audioStream;

      mediaRecorder.current = new MediaRecorder(audioStream, { mimeType });
      setIsVideo(false);

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: mediaRecorder.current.mimeType });
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
        if (onRecordingComplete) {
          onRecordingComplete(url);
        }
      };

      mediaRecorder.current.start(100);
      setIsRecording(true);
      setIsPaused(false);
      currentSessionStart.current = Date.now();
      timerInterval.current = setInterval(updateTimer, 200);
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
      currentSessionStart.current = null;
    }
  };

  const togglePause = () => {
    if (mediaRecorder.current && isRecording) {
      if (isPaused) {
        mediaRecorder.current.resume();
      } else {
        mediaRecorder.current.pause();
      }
      setIsPaused(!isPaused);
    }
  };

  const clearRecording = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את ההקלטה הקיימת?')) {
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
      setMediaUrl(null);
      setDuration(0);
      chunks.current = [];
    }
  };

  const handleStartRecording = () => {
    if (existingRecordingUrl) {
      setShowOverwriteModal(true);
    } else {
      startRecording();
    }
  };

  const handleDeleteRecording = async () => {
    setDeleteLoading(true);
    try {
      const recordingResponse = await fetch('https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/delete?' + 
        new URLSearchParams({
          patientId: patientID,
          fileName: `${patientID}.mp4`
        }).toString(), {
          method: 'DELETE',
          headers: {
            'x-api-key': process.env.REACT_APP_API_KEY || ''
          }
        });

      if (!recordingResponse.ok) {
        throw new Error('Failed to delete recording');
      }

      // Only clear recording-related state
      setMediaUrl(null);
      if (onRecordingDelete) onRecordingDelete();
      if (onRecordingComplete) onRecordingComplete(null);

      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
      chunks.current = [];
      setDuration(0);

    } catch (error) {
      console.error('Error deleting recording:', error);
      setError('שגיאה במחיקת ההקלטה');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUploadRecording = async () => {
    if (!mediaUrl || !chunks.current.length) return;
    
    console.log('Starting upload process...');
    console.log('Chunks available:', chunks.current.length);
    
    setIsTranscribing(true);
    setError('');
    setStatus({ type: null, message: null });
    
    try {
      const recordingBlob = new Blob(chunks.current, { type: 'video/mp4' });
      console.log('Created blob:', {
        size: recordingBlob.size,
        type: recordingBlob.type
      });

      // Convert blob to base64
      const base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(recordingBlob);
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = error => reject(error);
      });

      console.log('Converted to base64, sending to upload endpoint');
      
      const response = await fetch('https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || ''
        },
        body: JSON.stringify({
          id: patientID,
          file: base64File,
          fileName: `${patientID}.mp4`,
          contentType: 'video/mp4'
        })
      });

      console.log('Upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error response:', errorText);
        throw new Error(`Failed to upload: ${response.status}`);
      }

      const result = await response.json();
      console.log('Upload completed successfully:', result);
      
      setRecordingExistsOnServer(true);
      setStatus({ type: 'success', message: 'ההקלטה הועלתה בהצלחה' });
      
      // Call both callbacks
      if (onRecordingComplete) {
        onRecordingComplete(mediaUrl);
      }
      if (onUploadComplete) {
        onUploadComplete(patientID);  // This will trigger the refresh
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('שגיאה בהעלאת ההקלטה');
      setStatus({ type: 'error', message: 'שגיאה בהעלאת ההקלטה' });
    } finally {
      setIsTranscribing(false);
    }
  };

  const containerStyle = {
    width: '100%',
    border: '1px solid #eaeded',
    borderRadius: '8px',
    padding: '10px',
    backgroundColor: '#fff',
  };

  return (
    <div style={containerStyle}>
      <SpaceBetween direction="vertical" size="s">
        <SpaceBetween direction="horizontal" size="xs" alignItems="center">
          <Button
            variant="icon"
            iconSvg={isRecording ? <StopIcon /> : <RecordIcon />}
            onClick={isRecording ? stopRecording : handleStartRecording}
          />
          <Button
            variant="icon"
            iconName={isPaused ? "play" : "pause"}
            onClick={togglePause}
            disabled={!isRecording}
          />
          {mediaUrl && (
            <>
              <Button
                variant="icon"
                iconName="download"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = mediaUrl;
                  a.download = usedFormat === 'mp4'
                    ? `recording_${new Date().toISOString()}.mp4`
                    : `recording_${new Date().toISOString()}.mp3`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                disabled={!mediaUrl}
              />
            </>
          )}
          <Box color="text-status-info" fontSize="body-s">
            {duration ? `${duration.toFixed(1)}s` : '0s'}
          </Box>
        </SpaceBetween>

        {isRecording && (
          <StatusIndicator type="in-progress">
            {isPaused ? "Recording paused" : "Recording..."}
          </StatusIndicator>
        )}

        {isVideo && (
          <video
            ref={videoPreviewRef}
            style={{ width: '100%', display: isRecording ? 'none' : 'block' }}
            muted
          />
        )}

        {mediaUrl && (
          <>
            <audio
              ref={playbackRef}
              src={mediaUrl}
              controls
              style={{ width: '100%' }}
              onTimeUpdate={(e) => setDuration(e.target.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.target.duration)}
            >
              <source src={mediaUrl} type="video/mp4" />
              הדפדפן שלך אינו תומך בנגן השמע.
            </audio>

            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="normal" 
                onClick={handleDeleteRecording}
                disabled={isTranscribing || deleteLoading}
                loading={deleteLoading}
              >
                מחק הקלטה
              </Button>
              <Button
                variant="normal"
                onClick={handleUploadRecording}
                disabled={isTranscribing || !mediaUrl}
                loading={isTranscribing}
              >
                העלה הקלטה
              </Button>
            </SpaceBetween>

            {error && (
              <StatusIndicator type="error">
                {error}
              </StatusIndicator>
            )}
            {status.message && (
              <StatusIndicator type={status.type}>
                {status.message}
              </StatusIndicator>
            )}
          </>
        )}

        <Modal
          visible={showOverwriteModal}
          onDismiss={() => setShowOverwriteModal(false)}
          header="החלפת הקלטה קיימת"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="primary" 
                onClick={() => {
                  setShowOverwriteModal(false);
                  startRecording();
                }}
              >
                החלף הקלטה
              </Button>
              <Button 
                variant="link" 
                onClick={() => setShowOverwriteModal(false)}
              >
                ביטול
              </Button>
            </SpaceBetween>
          }
        >
          <p>נמצאה הקלטה קיימת. האם ברצונך להחליף אותה בהקלטה חדשה?</p>
        </Modal>

        {usedFormat === 'mp3' && (
          <Box fontSize="caption" color="text-status-error">
            MP4 אינו נתמך בדפדפן זה. הוקלטה באודיו (MP3) בלבד.
          </Box>
        )}
      </SpaceBetween>
    </div>
  );
}