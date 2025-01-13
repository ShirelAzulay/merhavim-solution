
import { Controller, Post, Body, Get } from '@nestjs/common';
import { AwsService } from './aws.service';

@Controller('aws')
export class AwsController {
  constructor(private readonly awsService: AwsService) {}

  // Upload a predefined file to the default bucket
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

  // Invoke a predefined Lambda function
  @Post('invoke-default-lambda')
  async invokeDefaultLambda() {
    try {
      const functionName = this.awsService.getDefaultLambdaFunction();
      const payload = { action: 'test-action', timestamp: new Date().toISOString() };

      const result = await this.awsService.invokeLambda(functionName, payload);
      return { message: `Lambda function '${functionName}' invoked successfully`, result };
    } catch (error) {
      console.error('Error invoking Lambda:', error);
      return { error: 'Failed to invoke Lambda function' };
    }
  }

  // Query Aurora database with a predefined SQL query
  @Post('query-default-aurora')
  async queryDefaultAurora() {
    try {
      const sql = 'SELECT * FROM your_table LIMIT 10;'; // Replace with a real SQL query

      const result = await this.awsService.queryAurora(sql);
      return { message: 'Aurora query executed successfully', result };
    } catch (error) {
      console.error('Error querying Aurora:', error);
      return { error: 'Failed to query Aurora database' };
    }
  }

  // Example for a GET route to check the default configuration
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
