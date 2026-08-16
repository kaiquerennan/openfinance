import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryRuleDto {
  /** Trecho procurado na descricao da transacao. */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  pattern: string;

  /** Categoria que passa a valer (chave Pluggy em minusculas). */
  @IsString()
  @MaxLength(80)
  category: string;
}

export class SetTransactionCategoryDto {
  /** Categoria corrigida. Null/ausente desfaz a correcao. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  /**
   * Cria tambem uma regra a partir da descricao, valendo para as transacoes
   * antigas e para as que chegarem nos proximos syncs.
   */
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;
}
