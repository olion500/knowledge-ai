import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from '../../common/entities/repository.entity';
import { RepositoryService } from './repository.service';
import { RepositoryController } from './repository.controller';
import { GitHubModule } from '../github/github.module';

@Module({
  imports: [TypeOrmModule.forFeature([Repository]), GitHubModule],
  controllers: [RepositoryController],
  providers: [RepositoryService],
  exports: [RepositoryService],
})
export class RepositoryModule {}
