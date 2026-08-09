import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
  private readonly reflector: Reflector,
  private readonly jwtService: JwtService,
  private readonly prisma: PrismaService,
) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      headers: Record<string, string | string[] | undefined>;
      user?: JwtPayload;
    }>();

    // 1. Extract from HttpOnly cookie
    let token = request.cookies?.['access_token'];

    // 2. Fallback to Authorization: Bearer <token> header
    if (!token && request.headers.authorization) {
      const authHeader = Array.isArray(request.headers.authorization)
        ? request.headers.authorization[0]
        : request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException(
        'Environment variable JWT_SECRET is required',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        iat: number;
      }>(token, {
        secret,
      });
      request.user = payload;

      // Token revocation check: reject tokens issued before tokenValidFrom
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenValidFrom: true },
      });
      if (user && payload.iat && payload.iat * 1000 < user.tokenValidFrom.getTime()) {
        throw new UnauthorizedException('Token has been revoked');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    return true;
  }
}
