import { Injectable, Inject } from '@nestjs/common';
import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import * as fs from 'fs';
import { Readable } from 'stream';
import * as path from 'path';

@Injectable()
export class AwsService {
  private readonly s3Client: S3Client;
  private readonly textractClient: TextractClient;
  private readonly transcribeClient: TranscribeClient;
  private readonly config: any;

  constructor(@Inject('CONFIG') private readonly globalConfig: any) {
    this.config = globalConfig['aws-config'];

    if (!this.config) {
      throw new Error('AWS Config not found');
    }

    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.aws_access_key_id,
        secretAccessKey: this.config.aws_secret_access_key,
      },
    });

    this.textractClient = new TextractClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.aws_access_key_id,
        secretAccessKey: this.config.aws_secret_access_key,
      },
    });

    this.transcribeClient = new TranscribeClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.aws_access_key_id,
        secretAccessKey: this.config.aws_secret_access_key,
      },
    });
  }

  getDefaultBucket(): string {
    return this.config.s3.default_bucket;
  }

  getConfig(): any {
    return this.config;
  }

  async uploadToS3(bucket: string, key: string, body: Buffer): Promise<void> {
    try {
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body });
      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw error;
    }
  }

  async downloadFromS3(bucket: string, key: string, destinationPath: string): Promise<void> {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.s3Client.send(command);

      const stream = response.Body as Readable;
      const writeStream = fs.createWriteStream(destinationPath);

      await new Promise((resolve, reject) => {
        stream.pipe(writeStream);
        stream.on('error', reject);
        writeStream.on('finish', resolve);
      });

      console.log(`File downloaded to: ${destinationPath}`);
    } catch (error) {
      console.error('Error downloading from S3:', error);
      throw error;
    }
  }

  async downloadFolderFromS3(bucket: string, folderKey: string, destinationFolder: string): Promise<void> {
    try {
      const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: folderKey });
      const response = await this.s3Client.send(command);

      if (!response.Contents || response.Contents.length === 0) {
        throw new Error(`No files found in folder: ${folderKey}`);
      }

      if (!fs.existsSync(destinationFolder)) {
        fs.mkdirSync(destinationFolder, { recursive: true });
      }

      for (const file of response.Contents) {
        const fileKey = file.Key!;
        const destinationPath = path.join(destinationFolder, fileKey.replace(folderKey, ''));

        console.log(`Downloading file: ${fileKey} to ${destinationPath}`);
        await this.downloadFromS3(bucket, fileKey, destinationPath);
      }

      console.log('Folder downloaded successfully');
    } catch (error) {
      console.error('Error downloading folder from S3:', error);
      throw error;
    }
  }

  async transcribeAudio(bucket: string, key: string): Promise<string> {
    const jobName = `transcription-job-${Date.now()}`;
    const startCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: 'en-US',
      Media: { MediaFileUri: `s3://${bucket}/${key}` },
      OutputBucketName: bucket,
    });

    await this.transcribeClient.send(startCommand);

    let status = 'IN_PROGRESS';
    while (status === 'IN_PROGRESS') {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const getCommand = new GetTranscriptionJobCommand({ TranscriptionJobName: jobName });
      const response = await this.transcribeClient.send(getCommand);
      status = response.TranscriptionJob?.TranscriptionJobStatus || 'FAILED';

      if (status === 'COMPLETED') {
        const transcriptUri = response.TranscriptionJob?.Transcript?.TranscriptFileUri!;
        const transcriptResponse = await fetch(transcriptUri);
        const transcriptData = await transcriptResponse.json();
        return transcriptData.results.transcripts.map((t: any) => t.transcript).join('\n');
      } else if (status === 'FAILED') {
        throw new Error(`Transcription job failed for file: ${key}`);
      }
    }
    return '';
  }

  async performOCR(bucket: string, key: string): Promise<string> {
    const startCommand = new StartDocumentTextDetectionCommand({
      DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
    });

    const startResponse = await this.textractClient.send(startCommand);
    const jobId = startResponse.JobId;

    if (!jobId) {
      throw new Error(`Failed to start OCR job for file: ${key}`);
    }

    let status = 'IN_PROGRESS';
    while (status === 'IN_PROGRESS') {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds

      const getCommand = new GetDocumentTextDetectionCommand({ JobId: jobId });
      const getResponse = await this.textractClient.send(getCommand);

      // Ensure status is always a string
      status = getResponse.JobStatus || 'UNKNOWN';

      if (status === 'SUCCEEDED') {
        return getResponse.Blocks?.map((block) => block.Text).join('\n') || '';
      } else if (status === 'FAILED') {
        throw new Error(`OCR job failed for file: ${key}`);
      }
    }
    return '';
  }

  async summarizeWithClaude(text: string): Promise<string> {
    // Mock implementation for summarization
    return `Summary: ${text.substring(0, 100)}...`;
  }

  async listFilesInS3Folder(bucket: string, folderKey: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: folderKey });
      const response = await this.s3Client.send(command);

      if (!response.Contents || response.Contents.length === 0) {
        throw new Error(`No files found in folder: ${folderKey}`);
      }

      // Extract file keys from the response
      return response.Contents.map((file) => file.Key!).filter((key) => !!key);
    } catch (error) {
      console.error('Error listing files in S3 folder:', error);
      throw error;
    }
  }

}
