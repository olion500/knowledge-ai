import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class EnvService {
  private readonly envFilePath: string;

  constructor() {
    this.envFilePath = path.resolve(process.cwd(), '../..', '.env');
  }

  async getEnvVariables(): Promise<Record<string, string>> {
    try {
      const content = await fs.readFile(this.envFilePath, 'utf-8');
      return this.parseEnvFile(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async updateEnvVariables(variables: Record<string, string>): Promise<void> {
    const existingVariables = await this.getEnvVariables();
    const updatedVariables = { ...existingVariables, ...variables };
    
    const content = Object.entries(updatedVariables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(this.envFilePath, content, 'utf-8');
  }

  private parseEnvFile(content: string): Record<string, string> {
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          acc[key.trim()] = value.trim();
        }
        return acc;
      }, {} as Record<string, string>);
  }
} 