import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { ProposeMatchesDto } from './dto/propose-matches.dto';

@ApiTags('matching')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('propose')
  @ApiOperation({ summary: 'Propose matches for transactions' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @HttpCode(HttpStatus.OK)
  async propose(@Body() dto: ProposeMatchesDto) {
    return this.matchingService.proposeMatches(dto);
  }
}
