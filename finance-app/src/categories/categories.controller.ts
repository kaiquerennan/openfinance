import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { resolvedCategory } from '../shared/category';
import {
  CreateCategoryRuleDto,
  SetTransactionCategoryDto,
} from './categories.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** GET /categories/rules — regras de recategorizacao cadastradas. */
  @Get('rules')
  rules() {
    return this.categories.rules();
  }

  /**
   * POST /categories/rules — cria a regra e ja recategoriza o extrato inteiro.
   */
  @Post('rules')
  createRule(@Body() dto: CreateCategoryRuleDto) {
    return this.categories.createRule(dto.pattern, dto.category);
  }

  /**
   * DELETE /categories/rules/:id — remove a regra e devolve as transacoes
   * dela a categoria original.
   */
  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.categories.deleteRule(id);
  }

  /**
   * PATCH /categories/transactions/:id — corrige a categoria de uma transacao.
   * Sem `category`, desfaz a correcao. Com `applyToAll`, vira regra.
   */
  @Patch('transactions/:id')
  async correct(
    @Param('id') id: string,
    @Body() dto: SetTransactionCategoryDto,
  ) {
    const tx = await this.categories.correct(
      id,
      dto.category ?? null,
      dto.applyToAll,
    );
    // Devolve ja com a categoria que vale, para a tela nao precisar repetir a
    // regra de precedencia para atualizar a linha.
    return tx && { ...tx, category: resolvedCategory(tx) };
  }
}
