import { Module } from "@nestjs/common";
import { OpenAIClient } from "./openai.client";
import { OpenAIRepository } from "./openai.repository";
import { OpenAIService } from "./openai.service";

@Module({
  imports: [],
  providers: [OpenAIClient, OpenAIRepository, OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
