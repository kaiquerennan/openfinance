import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { Public } from './public.decorator';

const SESSION_COOKIE = 'session';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Compara a senha em tempo constante.
 *
 * Passa os dois lados por SHA-256 antes de comparar: alem de igualar o
 * tamanho (timingSafeEqual exige buffers do mesmo tamanho), evita que o
 * tempo de resposta denuncie o comprimento da senha correta.
 */
function passwordMatches(input: string | undefined): boolean {
  const expected = process.env.APP_PASSWORD ?? '';
  if (!expected) return false;
  const digest = (value: string) =>
    crypto.createHash('sha256').update(value, 'utf8').digest();
  return crypto.timingSafeEqual(digest(input ?? ''), digest(expected));
}

@Controller('auth')
export class AuthController {
  /**
   * POST /auth/login — { password } -> seta cookie de sessao (30 dias).
   *
   * O app inteiro e protegido por uma senha unica, entao o login e o unico
   * alvo que vale a pena atacar: no maximo 5 tentativas por minuto por IP.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
