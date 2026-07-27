import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { Public } from './public.decorator';

const SESSION_COOKIE = 'session';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function passwordMatches(input: string | undefined): boolean {
  const expected = process.env.APP_PASSWORD ?? '';
  if (!expected || !input || input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

@Controller('auth')
export class AuthController {
  /** POST /auth/login — { password } -> seta cookie de sessao (30 dias). */
  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body('password') password: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!passwordMatches(password)) {
      throw new UnauthorizedException('Senha incorreta');
    }
    const token = jwt.sign({ sub: 'owner' }, process.env.AUTH_SECRET as string, {
      expiresIn: '30d',
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: THIRTY_DAYS_MS,
    });
    return { ok: true };
  }

  /** POST /auth/logout — limpa o cookie de sessao. */
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE);
    return { ok: true };
  }

  /** GET /auth/me — 200 se a sessao for valida (AuthGuard cuida da checagem). */
  @Get('me')
  me() {
    return { ok: true };
  }
}
