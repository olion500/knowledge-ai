import { Module, forwardRef } from '@nestjs/common';
import { JiraService } from './jira.service';
import { JiraController } from './jira.controller';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [forwardRef(() => DocumentModule)],
  controllers: [JiraController],
  providers: [JiraService],
  exports: [JiraService],
})
export class JiraModule {}
