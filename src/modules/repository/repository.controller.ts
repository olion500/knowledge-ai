import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { RepositoryService } from './repository.service';
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  RepositoryResponseDto,
  SyncRepositoryDto,
} from '../../common/dto/repository.dto';

@ApiTags('repositories')
@Controller('repositories')
export class RepositoryController {
  constructor(private readonly repositoryService: RepositoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new repository' })
  @ApiBody({ type: CreateRepositoryDto })
  @ApiResponse({
    status: 201,
    description: 'Repository created successfully',
    type: RepositoryResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Repository already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Repository not found or not accessible',
  })
  async create(
    @Body(ValidationPipe) createRepositoryDto: CreateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    return this.repositoryService.create(createRepositoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all repositories' })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of repositories',
    type: [RepositoryResponseDto],
  })
  async findAll(
    @Query('active') active?: boolean,
  ): Promise<RepositoryResponseDto[]> {
    const options = active !== undefined ? { active } : undefined;
    return this.repositoryService.findAll(options);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repository by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Repository found',
    type: RepositoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RepositoryResponseDto> {
    return this.repositoryService.findOne(id);
  }

  @Get('by-name/:owner/:name')
  @ApiOperation({ summary: 'Get repository by owner and name' })
  @ApiParam({ name: 'owner', type: 'string' })
  @ApiParam({ name: 'name', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Repository found',
    type: RepositoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async findByFullName(
    @Param('owner') owner: string,
    @Param('name') name: string,
  ): Promise<RepositoryResponseDto | null> {
    return this.repositoryService.findByFullName(owner, name);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update repository' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateRepositoryDto })
  @ApiResponse({
    status: 200,
    description: 'Repository updated successfully',
    type: RepositoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateRepositoryDto: UpdateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    return this.repositoryService.update(id, updateRepositoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete repository' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 204,
    description: 'Repository deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.repositoryService.remove(id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sync repository with GitHub' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: SyncRepositoryDto, required: false })
  @ApiResponse({
    status: 200,
    description: 'Repository synced successfully',
    type: RepositoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to sync repository',
  })
  async syncRepository(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) syncDto?: SyncRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    return this.repositoryService.syncRepository(id, syncDto);
  }

  @Get(':id/files')
  @ApiOperation({ summary: 'Get repository files and directories' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({
    name: 'path',
    required: false,
    type: 'string',
    description: 'Directory path to list (default: root)',
  })
  @ApiQuery({
    name: 'branch',
    required: false,
    type: 'string',
    description: 'Branch name (default: default branch)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of files and directories',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          path: { type: 'string' },
          type: { type: 'string', enum: ['file', 'dir'] },
          size: { type: 'number' },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async getRepositoryFiles(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('path') path = '',
    @Query('branch') branch?: string,
  ): Promise<
    Array<{ name: string; path: string; type: 'file' | 'dir'; size?: number }>
  > {
    return this.repositoryService.getRepositoryFiles(id, path, branch);
  }

  @Get(':id/files/content')
  @ApiOperation({ summary: 'Get file content' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({
    name: 'filePath',
    required: true,
    type: 'string',
    description: 'Path to the file',
  })
  @ApiQuery({
    name: 'branch',
    required: false,
    type: 'string',
    description: 'Branch name (default: default branch)',
  })
  @ApiResponse({
    status: 200,
    description: 'File content',
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        language: { type: 'string' },
        size: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Repository or file not found',
  })
  async getFileContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('filePath') filePath: string,
    @Query('branch') branch?: string,
  ): Promise<{ content: string; language: string; size: number }> {
    return this.repositoryService.getFileContent(id, filePath, branch);
  }
}
