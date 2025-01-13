import { Injectable, Inject } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';



@Injectable()
export class AwsService {
  private readonly s3Client: S3Client;
  private readonly lambdaClient: LambdaClient;
  private readonly rdsClient: RDSDataClient;
  private readonly config: any;

  constructor(
      @Inject('CONFIG') private readonly globalConfig: any,
  ) {
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
  }

  getDefaultBucket(): string {
    return this.config.s3.default_bucket;
  }

  getDefaultLambdaFunction(): string {
    return this.config.lambda.functions['processData']; // Example: "processData"
  }

  getConfig(): any {
    return this.config;
  }

  async uploadToS3(bucket: string, key: string, body: Buffer): Promise<void> {
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body });
    await this.s3Client.send(command);
  }

  async invokeLambda(functionName: string, payload: object): Promise<any> {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(payload)),
    });
    const response = await this.lambdaClient.send(command);
    return JSON.parse(new TextDecoder().decode(response.Payload));
  }

  async queryAurora(sql: string): Promise<any> {
    const command = new ExecuteStatementCommand({
      secretArn: this.config.rds.secret_arn,
      resourceArn: this.config.rds.resource_arn,
      sql,
      database: this.config.rds.database_name,
    });
    const response = await this.rdsClient.send(command);
    return response.records;
  }
}
