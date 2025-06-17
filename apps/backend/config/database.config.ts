import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  // Check if we want to skip database for testing
  if (process.env.SKIP_DATABASE === 'true') {
    return {
      type: 'sqlite',
      database: ':memory:',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'knowledge_sync_ai',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    retryAttempts: 3,
    retryDelay: 3000,
  };
};
