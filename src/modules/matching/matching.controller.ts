import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { ProposeMatchesDto } from './dto/propose-matches.dto';

@ApiTags('matching')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('propose')
  @HttpCode(HttpStatus.OK)
  async propose(@Body() dto: ProposeMatchesDto) {
    return this.matchingService.proposeMatches(dto);
  }
}
