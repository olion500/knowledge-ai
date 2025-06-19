import { Module } from '@nestjs/common';
import { EnvController } from './controllers/env.controller';
import { EnvService } from './services/env.service';

@Module({
  controllers: [EnvController],
  providers: [EnvService],
})
export class AdminModule {} 