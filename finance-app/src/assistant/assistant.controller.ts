import { Body, Controller, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** POST /assistant/ask — { question, month? } -> { answer }. */
  @Post('ask')
  ask(@Body('question') question: string, @Body('month') month?: string) {
    return this.assistant.ask(question, month);
  }
}
