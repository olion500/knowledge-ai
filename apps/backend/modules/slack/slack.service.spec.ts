import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SlackService } from './slack.service';

describe('SlackService', () => {
  let service: SlackService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('xoxb-test-token'),
          },
        },
      ],
    }).compile();

    service = module.get<SlackService>(SlackService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with slack token from config', () => {
    expect(configService.get).toHaveBeenCalledWith('SLACK_BOT_TOKEN');
  });
});
