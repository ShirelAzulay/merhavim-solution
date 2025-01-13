import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [response, setResponse] = useState(null);

  const handleUploadToS3 = async () => {
    try {
      const res = await axios.post('http://localhost:3000/aws/upload-s3', {
        bucket: 'your-bucket-name',
        key: 'test.txt',
        content: 'Hello from React!',
      });
      setResponse(res.data);
    } catch (error) {
      console.error('Error uploading to S3:', error.message);
      setResponse({ error: error.message });
    }
  };

  const handleInvokeLambda = async () => {
    const res = await axios.post('http://localhost:3000/aws/invoke-lambda', {
      functionName: 'your-lambda-function-name',
      payload: { key: 'value' },
    });
    setResponse(res.data);
  };

  const handleQueryAurora = async () => {
    const res = await axios.post('http://localhost:3000/aws/query-aurora', {
      sql: 'SELECT * FROM your_table',
    });
    setResponse(res.data);
  };

  return (
    <div>
      <h1>AWS Demo</h1>
      <button onClick={handleUploadToS3}>Upload to S3</button>
      <button onClick={handleInvokeLambda}>Invoke Lambda</button>
      <button onClick={handleQueryAurora}>Query Aurora</button>
      <pre>{JSON.stringify(response, null, 2)}</pre>
    </div>
  );
}

export default App;