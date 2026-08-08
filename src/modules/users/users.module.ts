import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
