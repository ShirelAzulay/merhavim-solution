import { Module } from '@nestjs/common';
import { AwsModule } from './aws/aws.module';
import { ConfigModule } from './config.module';

@Module({
  imports: [AwsModule, ConfigModule],
})
export class AppModule {}
