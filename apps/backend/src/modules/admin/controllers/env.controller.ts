import { Controller, Get, Post, Body } from '@nestjs/common';
import { EnvService } from '../services/env.service';

@Controller('admin/env')
export class EnvController {
  constructor(private readonly envService: EnvService) {}

  @Get()
  async getEnvVariables() {
    return this.envService.getEnvVariables();
  }

  @Post()
  async updateEnvVariables(@Body() variables: Record<string, string>) {
    await this.envService.updateEnvVariables(variables);
    return { message: 'Environment variables updated successfully' };
  }
} 