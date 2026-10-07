import { Module } from '@nestjs/common';
import { WalkersController } from './walkers.controller.js';
import { WalkersService } from './walkers.service.js';

@Module({
  controllers: [WalkersController],
  providers: [WalkersService],
  exports: [WalkersService],
})
export class WalkersModule {}
