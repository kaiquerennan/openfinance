import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertBudgetDto {
  /** Categoria (chave Pluggy em minusculas) ou "_global" para o limite geral. */
  @IsString()
  @MaxLength(80)
  category: string;

  /** Valor do limite mensal; 0 remove o limite. */
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateGoalDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;

  @IsNumber()
  @Min(0.01)
  targetAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyContribution?: number;

  /** Data limite ISO (YYYY-MM-DD), opcional. */
  @IsOptional()
  @IsString()
  deadline?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyContribution?: number;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'READY', 'DONE'])
  status?: string;
}

export class AddGoalEntryDto {
  /** Mes do aporte no formato YYYY-MM. */
  @IsString()
  @MaxLength(7)
  month: string;

  /** Valor do aporte (soma ao ja existente no mes; negativo estorna). */
  @IsNumber()
  amount: number;
}

/** Decide uma sugestao de aporte: com goalId contabiliza, sem ele dispensa. */
export class DecideSuggestionDto {
  @IsOptional()
  @IsString()
  goalId?: string;
}
