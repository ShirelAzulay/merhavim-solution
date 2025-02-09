const API_URL = 'https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/transcribe';
const API_KEY = process.env.REACT_APP_API_KEY || '';

export async function getUploadUrl(patientID) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        patientID,
        uploaded: false
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get upload URL');
    }

    const data = await response.json();
    console.log('Upload URL response:', data); // Debug log
    
    if (!data.upload_url) {
      throw new Error('No upload URL in response');
    }

    return data.upload_url;
  } catch (error) {
    console.error('Error getting upload URL:', error);
    throw error;
  }
}

export async function uploadRecording(file, patientID) {
  try {
    // Get pre-signed URL
    const uploadUrl = await getUploadUrl(patientID);
    
    if (!uploadUrl) {
      throw new Error('No upload URL received');
    }

    console.log('Uploading to URL:', uploadUrl);
    console.log('File being uploaded:', file);

    // Upload file to S3 - remove no-cors mode and let the pre-signed URL handle authorization
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4'
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload recording: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error uploading recording:', error);
    throw error;
  }
}

export async function startTranscription(patientID, fileName) {
  try {
    const response = await fetch('https://fu9nj81we9.execute-api.eu-west-1.amazonaws.com/testing/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.REACT_APP_API_KEY || ''
      },
      body: JSON.stringify({
        patientID,
        fileName
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to start transcription: ${errorText}`);
    }

    const data = await response.json();
    return data.transcript || '';
  } catch (error) {
    console.error('Error starting transcription:', error);
    throw error;
  }
}

// Add a helper function to check if the API is accessible
export async function checkApiAccess() {
  try {
    const response = await fetch(API_URL, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      mode: 'cors',
      credentials: 'omit'
    });
    return response.ok;
  } catch (error) {
    console.error('API access check failed:', error);
    return false;
  }
} 