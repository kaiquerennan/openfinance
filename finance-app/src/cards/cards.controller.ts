import { Controller, Get } from '@nestjs/common';
import { CardsService } from './cards.service';

@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  /**
   * GET /cards/bills — faturas fechadas de cada cartao, com variacao,
   * encargos e o quanto ja corre para a proxima.
   */
  @Get('bills')
  bills() {
    return this.cards.bills();
  }
}
