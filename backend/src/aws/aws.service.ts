import { Injectable, Inject } from '@nestjs/common';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { TextractClient, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import * as fs from 'fs';
import { Readable } from 'stream';
import * as path from 'path';


@Injectable()
export class AwsService {
  private readonly s3Client: S3Client;
  private readonly lambdaClient: LambdaClient;
  private readonly rdsClient: RDSDataClient;
  private readonly textractClient: TextractClient;
  private readonly config: any;

  constructor(@Inject('CONFIG') private readonly globalConfig: any) {
    this.config = globalConfig['aws-config'];

    if (!this.config) {
      throw new Error('AWS Config not found');
    }

    console.log('Loaded AWS Config:', this.config);

    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.aws_access_key_id,
        secretAccessKey: this.config.aws_secret_access_key,
      },
    });

    this.lambdaClient = new LambdaClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.aws_access_key_id,
        secretAccessKey: this.config.aws_secret_access_key,
      },
    });

    this.rdsClient = new RDSDataClient({
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
  }

  getDefaultBucket(): string {
    return this.config.s3.default_bucket;
  }

  getDefaultLambdaFunction(): string {
    return this.config.lambda.functions['processData'];
  }

  getConfig(): any {
    return this.config;
  }


  async invokeLambda(functionName: string, payload: object): Promise<any> {
    try {
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify(payload)),
      });
      const response = await this.lambdaClient.send(command);
      return JSON.parse(new TextDecoder().decode(response.Payload));
    } catch (error) {
      console.error('Error invoking Lambda:', error);
      throw error;
    }
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
        const fileKey: string | undefined = file.Key;

        if (!fileKey) {
          console.warn('Skipping file with undefined Key');
          continue; // Skip file with undefined Key
        }

        const fileName: string = fileKey.replace(folderKey, '').replace(/^\/?/, '');
        const destinationPath: string = path.join(destinationFolder, fileName);

        console.log(`Downloading file: ${fileKey} to ${destinationPath}`);
        await this.downloadFromS3(bucket, fileKey, destinationPath);
      }

      console.log('Folder downloaded successfully');
    } catch (error) {
      console.error('Error downloading folder from S3:', error);
      throw error;
    }
  }

  async performOCR(bucket: string, key: string): Promise<any> {
    try {
      const startCommand = new StartDocumentTextDetectionCommand({
        DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
      });
      const startResponse = await this.textractClient.send(startCommand);

      const jobId = startResponse.JobId;
      console.log(`Started OCR job for file: ${key}, Job ID: ${jobId}`);

      let status: string | undefined = 'IN_PROGRESS';
      while (status === 'IN_PROGRESS') {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
        const getCommand = new GetDocumentTextDetectionCommand({ JobId: jobId });
        const getResponse = await this.textractClient.send(getCommand);
        status = getResponse.JobStatus;

        if (status === 'SUCCEEDED') {
          return getResponse.Blocks;
        } else if (status === 'FAILED') {
          throw new Error(`OCR job failed for file: ${key}`);
        }
      }
    } catch (error) {
      console.error('Error performing OCR:', error);
      throw error;
    }
  }

  async queryAurora(sql: string): Promise<any> {
    try {
      const command = new ExecuteStatementCommand({
        secretArn: this.config.rds.secret_arn,
        resourceArn: this.config.rds.resource_arn,
        sql,
        database: this.config.rds.database_name,
      });
      const response = await this.rdsClient.send(command);
      return response.records;
    } catch (error) {
      console.error('Error querying Aurora:', error);
      throw error;
    }
  }
}
