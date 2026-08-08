import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';

@Module({
  providers: [
    CloudinaryService,
    {
      provide: STORAGE_PROVIDER,
      useExisting: CloudinaryService,
    },
  ],
  exports: [CloudinaryService, STORAGE_PROVIDER],
})
export class CloudinaryModule {}
