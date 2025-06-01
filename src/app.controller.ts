import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { LLMService } from './modules/llm/llm.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly llmService: LLMService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('health/llm')
  async getLLMHealth() {
    try {
      const providerStatus = await this.llmService.checkProviderAvailability();
      return {
        status: providerStatus.available ? 'ok' : 'unavailable',
        timestamp: new Date().toISOString(),
        ...providerStatus,
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
