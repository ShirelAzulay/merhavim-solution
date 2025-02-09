import React, { useState, useEffect } from 'react';
import { 
  Container,
  SpaceBetween,
  Button,
  StatusIndicator,
  Textarea,
  Checkbox,
  TokenGroup,
  Select
} from '@cloudscape-design/components';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { convertPdfToImages } from '../components/pdfHelper';
import config from '../config';

export default function Step3({ patientID }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [availableTranscripts, setAvailableTranscripts] = useState([]);
  const [pdfPageCounts, setPdfPageCounts] = useState({});
  
  const [transcriptContent, setTranscriptContent] = useState('');

  const [settings, setSettings] = useState({
    system_instructions: '',
    prompt: '',
    max_tokens: 4096
  });

  const getPDFPageCount = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const pageCount = await convertPdfToImages(blob, true);
      return pageCount;
    } catch (error) {
      console.error('Error getting PDF page count:', error);
      return null;
    }
  };

  const fetchAvailableTranscripts = async () => {
    try {
      const response = await fetch('https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/files?' + 
        new URLSearchParams({
          patientId: patientID,
          fileName: '*.json'
        }).toString(), {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.REACT_APP_API_KEY || ''
          }
        });

      if (response.ok) {
        const data = await response.json();
        setAvailableTranscripts(data.files || []);
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error);
      setError('שגיאה בטעינת רשימת התמלולים');
    }
  };

  const fetchExistingPDFs = async () => {
    try {
      const response = await fetch('https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/files?' + 
        new URLSearchParams({
          patientId: patientID,
          fileName: '*.pdf'
        }).toString(), {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.REACT_APP_API_KEY || ''
          }
        });

      if (response.ok) {
        const data = await response.json();
        setExistingFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error fetching PDFs:', error);
      setError('שגיאה בטעינת קבצי PDF');
    }
  };

  useEffect(() => {
    if (patientID) {
      fetchExistingPDFs();
      fetchAvailableTranscripts();
    }
  }, [patientID]);

  useEffect(() => {
    const fetchPageCounts = async () => {
      const counts = {};
      for (const file of existingFiles) {
        const count = await getPDFPageCount(file.url);
        if (count) {
          counts[file.url] = count;
        }
      }
      setPdfPageCounts(counts);
    };

    if (existingFiles.length > 0) {
      fetchPageCounts();
    }
  }, [existingFiles]);

  const loadTranscriptContent = async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return data.results?.transcripts?.[0]?.transcript || '';
      }
    } catch (error) {
      console.error('Error loading transcript:', error);
      setError('שגיאה בטעינת התמלול');
    }
    return '';
  };

  const handleAnalyze = async () => {
    if (!termsAccepted) {
      setError('יש לאשר את תנאי השימוש לפני הפקת הסיכום');
      return;
    }

    if (existingFiles.length === 0 && availableTranscripts.length === 0) {
      setError('לא נמצאו קבצים לניתוח');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      // First, load all transcripts
      console.log('Loading transcripts...');
      const transcriptContents = await Promise.all(
        availableTranscripts.map(async transcript => {
          const content = await loadTranscriptContent(transcript.url);
          return {
            name: transcript.fileName,
            content: content
          };
        })
      );

      // Combine all transcripts with clear separators
      const allTranscripts = transcriptContents
        .map(t => `תמלול: ${t.name}\n${t.content}`)
        .join('\n\nתמלול:\n');  // Add clear separator between transcripts

      // Then, convert all PDFs to images
      console.log('Converting PDFs to images...');
      let images = [];
      for (const pdfFile of existingFiles) {
        console.log(`Processing PDF: ${pdfFile.fileName}`);
        const response = await fetch(pdfFile.url);
        const pdfBlob = await response.blob();
        const base64Images = await convertPdfToImages(pdfBlob);
        images.push(...base64Images.map(base64 => ({
          data: base64,
          media_type: 'image/jpeg'
        })));
      }

      console.log(`Sending request with ${transcriptContents.length} transcripts and ${images.length} images`);
      const payload = {
        system_instructions: settings.system_instructions,
        prompt: settings.prompt,
        images: images,
        max_tokens: settings.max_tokens
      };
      console.log('Step3 analysis payload:', payload);

      const response = await fetch('https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/bedrock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || ''
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to get AI analysis');
      }

      const data = await response.json();
      const parsedResponse = JSON.parse(data.result);
      const textContent = parsedResponse.content[0].text;
      setAiResponse(textContent);
      setIsEditing(true);
    } catch (err) {
      console.error('Analysis error:', err);
      setError('שגיאה בניתוח הנתונים');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveToWord = async () => {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: aiResponse
            .split('\n')
            .map(line => new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  font: 'Arial',
                  size: 24,
                  rtl: true
                })
              ],
              spacing: {
                after: 200
              },
              bidirectional: true
            }))
        }]
      });

      const blob = await Packer.toBlob(doc);
      
      saveAs(blob, `סיכום_מטופל_${patientID}_${new Date().toLocaleDateString('he-IL')}.docx`);
    } catch (error) {
      console.error('Error saving document:', error);
      setError('שגיאה בשמירת המסמך');
    }
  };

  const handlePDFDismiss = (index) => {
    setExistingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTranscriptDismiss = (index) => {
    setAvailableTranscripts(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${config.API_URL}/settings`);
        const data = await response.json();
        console.log('Step3 fetched settings:', data);
        setSettings(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
        setError('שגיאה בטעינת הגדרות');
      }
    };
    
    fetchSettings();
  }, []);

  return (
    <Container 
      header={<h2>ניתוח עם בינה מלאכותית</h2>}
      className="step-container expanded"
      disableContentPaddings={false}
    >
      <SpaceBetween direction="vertical" size="l">
        <div>
          <h3>מסמכים</h3>
          <TokenGroup
            alignment="vertical"
            items={existingFiles.map(file => ({
              label: file.fileName,
              labelTag: 'PDF',
              description: `${pdfPageCounts[file.url]} עמודים | ${(file.size / 1024).toFixed(2)} KB`,
              dismissLabel: `הסר ${file.name}`
            }))}
            onDismiss={({ detail }) => handlePDFDismiss(detail.itemIndex)}
          />
        </div>

        <div>
          <h3>תמלולים</h3>
          <TokenGroup
            alignment="vertical"
            items={availableTranscripts.map(file => ({
              label: file.fileName,
              labelTag: 'JSON',
              description: new Date(file.lastModified).toLocaleString(),
              dismissLabel: `הסר ${file.name}`
            }))}
            onDismiss={({ detail }) => handleTranscriptDismiss(detail.itemIndex)}
          />
        </div>

        <SpaceBetween direction="vertical" size="m">
          <Checkbox
            checked={termsAccepted}
            onChange={({ detail }) => setTermsAccepted(detail.checked)}
            description="אני מאשר/ת כי קראתי והבנתי את תנאי השימוש במערכת ומסכים/ה להם"
          >
            אישור תנאי שימוש
          </Checkbox>
          
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={handleAnalyze}
              loading={isAnalyzing}
              disabled={(existingFiles.length === 0 && availableTranscripts.length === 0) || isAnalyzing || !termsAccepted}
            >
              נתח עם בינה מלאכותית
            </Button>
            
            {aiResponse && (
              <Button
                variant="normal"
                onClick={handleSaveToWord}
                iconName="download"
              >
                שמור כקובץ Word
              </Button>
            )}
          </SpaceBetween>
          
          {error && (
            <StatusIndicator type="error">
              {error}
            </StatusIndicator>
          )}
        </SpaceBetween>

        {aiResponse && (
          <Container header={<h3>ניתוח AI</h3>}>
            <Textarea
              value={aiResponse}
              onChange={({ detail }) => setAiResponse(detail.value)}
              rows={50}
              style={{
                backgroundColor: '#f8f8f8',
                lineHeight: '1.5'
              }}
            />
          </Container>
        )}
      </SpaceBetween>
    </Container>
  );
}