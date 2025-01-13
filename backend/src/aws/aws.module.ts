import { Module } from '@nestjs/common';
import { AwsService } from './aws.service';
import { AwsController } from './aws.controller';
import { ConfigModule } from '../config.module';

@Module({
  imports: [ConfigModule],
  providers: [AwsService],
  controllers: [AwsController],
})
export class AwsModule {}
