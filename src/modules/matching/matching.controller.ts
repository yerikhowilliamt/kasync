import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { ProposeMatchesDto } from './dto/propose-matches.dto';
import { ReqUser } from '../../common/decorators/req-user.decorator';

@ApiTags('matching')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('propose')
  @ApiOperation({ summary: 'Propose matches for transactions' })
  @ApiResponse({ status: 200, description: 'Match candidates returned' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @HttpCode(HttpStatus.OK)
  async propose(
    @ReqUser('sub') userId: string,
    @Body() dto: ProposeMatchesDto,
  ) {
    return this.matchingService.proposeMatches(userId, dto);
  }

  @Post('reset')
  @ApiOperation({
    summary: 'Reset PENDING_REVIEW transactions back to UNRESOLVED',
  })
  @ApiResponse({ status: 200, description: 'Matches reset successfully' })
  @HttpCode(HttpStatus.OK)
  async reset(
    @ReqUser('sub') userId: string,
    @Body() body: { accountId?: string },
  ) {
    return this.matchingService.resetMatches(userId, body.accountId);
  }
}
