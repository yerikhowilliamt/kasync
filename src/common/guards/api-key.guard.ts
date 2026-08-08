import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const expectedApiKey = process.env.API_KEY;
    // If API_KEY environment variable is not explicitly configured, bypass auth in dev mode
    if (!expectedApiKey) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException(
        'Invalid or missing API key (x-api-key header required)',
      );
    }

    return true;
  }
}
