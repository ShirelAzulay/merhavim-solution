import { Controller, Post, Body, Get } from '@nestjs/common';
import { AwsService } from './aws.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('aws')
export class AwsController {
  constructor(private readonly awsService: AwsService) {}

  @Post('upload-to-default-bucket')
  async uploadToDefaultBucket() {
    try {
      const defaultBucket = this.awsService.getDefaultBucket();
      const key = 'example-file.txt';
      const content = 'This is a sample file content for S3.';

      await this.awsService.uploadToS3(defaultBucket, key, Buffer.from(content));
      return { message: `File '${key}' uploaded to bucket '${defaultBucket}' successfully` };
    } catch (error) {
      console.error('Error uploading to S3:', error);
      return { error: 'Failed to upload file to S3' };
    }
  }

  @Post('download-from-default-bucket')
  async downloadFromDefaultBucket(@Body() body: { key: string; destinationPath: string }) {
    try {
      const defaultBucket = this.awsService.getDefaultBucket();
      await this.awsService.downloadFromS3(defaultBucket, body.key, body.destinationPath);
      return { message: `File '${body.key}' downloaded to '${body.destinationPath}' successfully` };
    } catch (error) {
      console.error('Error downloading from S3:', error);
      return { error: 'Failed to download file from S3' };
    }
  }

  @Post('download-folder-from-s3')
  async downloadFolderFromS3(@Body() body: { key: string; destinationFolder: string }) {
    try {
      const defaultBucket = this.awsService.getDefaultBucket();
      await this.awsService.downloadFolderFromS3(defaultBucket, body.key, body.destinationFolder);
      return { message: `Folder '${body.key}' downloaded to '${body.destinationFolder}' successfully` };
    } catch (error) {
      console.error('Error downloading folder from S3:', error);
      return { error: 'Failed to download folder from S3' };
    }
  }

  @Post('process-id')
  async processId(@Body() body: { id: string }) {
    try {
      const { id } = body;
      const defaultBucket = this.awsService.getDefaultBucket();
      const folderKey = `${id}/`;

      // Step 1: List files in the S3 folder
      const files = await this.awsService.listFilesInS3Folder(defaultBucket, folderKey);
      let fullText = '';

      // Step 2: Process each file
      for (const fileKey of files) {
        const extension = fileKey.split('.').pop()?.toLowerCase();

        if (['mp3', 'mp4', 'wav'].includes(extension!)) {
          // Transcribe audio files
          console.log(`Meanwhile Do Nothing-Transcribing audio file: ${fileKey}`);
/*          const transcript = await this.awsService.transcribeAudio(defaultBucket, fileKey);
          fullText += `\n\n--- Transcript of ${fileKey} ---\n${transcript}`;*/
        } else if (extension === 'pdf') {
          // Perform OCR on PDF files
          const ocrResult = await this.awsService.performOCR(defaultBucket, fileKey);
          fullText += `\n\n--- OCR of ${fileKey} ---\n${ocrResult}`;
        }
      }

      // Step 3: Summarize the text using an LLM
      const summary = await this.awsService.summarizeWithClaude(fullText);

      // Step 4: Return the summary
      return { message: 'Processing completed successfully', summary };
    } catch (error) {
      console.error('Error processing ID:', error);
      return { error: 'Failed to process ID' };
    }
  }

  @Get('config')
  async getConfig() {
    try {
      const config = this.awsService.getConfig();
      return { message: 'AWS Configuration loaded successfully', config };
    } catch (error) {
      console.error('Error loading config:', error);
      return { error: 'Failed to load AWS configuration' };
    }
  }
}
