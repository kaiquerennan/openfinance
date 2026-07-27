import { SetMetadata } from '@nestjs/common';

/** Marca uma rota como acessivel sem sessao (login, webhook da Pluggy). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
