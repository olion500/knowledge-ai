import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get(AppService);
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      const result = 'Hello World!';
      appService.getHello.mockReturnValue(result);

      expect(appController.getHello()).toBe(result);
      expect(appService.getHello).toHaveBeenCalled();
    });
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const mockDate = new Date('2024-01-01T00:00:00.000Z');
      const mockUptime = 3600; // 1 hour

      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      jest.spyOn(process, 'uptime').mockReturnValue(mockUptime);

      const result = appController.getHealth();

      expect(result).toEqual({
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        uptime: 3600,
      });

      jest.restoreAllMocks();
    });

    it('should return current timestamp and uptime', () => {
      const result = appController.getHealth();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.uptime).toBe('number');
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
