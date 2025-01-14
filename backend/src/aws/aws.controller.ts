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

  @Post('perform-ocr-on-folder')
  async performOCROnFolder(@Body() body: { folderPath: string }) {
    try {
      const files = fs.readdirSync(body.folderPath).filter((file) => file.endsWith('.pdf'));
      const defaultBucket = this.awsService.getDefaultBucket();
      const results = [];

      for (const file of files) {
        const filePath = path.join(body.folderPath, file);
        await this.awsService.uploadToS3(defaultBucket, `ocr/${file}`, fs.readFileSync(filePath));
        const ocrResult = await this.awsService.performOCR(defaultBucket, `ocr/${file}`);
        results.push({ file, ocrResult });
      }

      return { message: 'OCR completed for all files', results };
    } catch (error) {
      console.error('Error performing OCR on folder:', error);
      return { error: 'Failed to perform OCR on folder' };
    }
  }

  @Post('invoke-default-lambda')
  async invokeDefaultLambda(): Promise<any> {
    try {
      const functionName: string = this.awsService.getDefaultLambdaFunction();
      const payload = { action: 'test-action', timestamp: new Date().toISOString() };

      const result: any = await this.awsService.invokeLambda(functionName, payload);
      return { message: `Lambda function '${functionName}' invoked successfully`, result };
    } catch (error) {
      console.error('Error invoking Lambda:', error);
      return { error: 'Failed to invoke Lambda function' };
    }
  }


  @Post('query-default-aurora')
  async queryDefaultAurora() {
    try {
      const sql = 'SELECT * FROM your_table LIMIT 10;';
      const result = await this.awsService.queryAurora(sql);
      return { message: 'Aurora query executed successfully', result };
    } catch (error) {
      console.error('Error querying Aurora:', error);
      return { error: 'Failed to query Aurora database' };
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
