import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  email!: string;

  @Expose()
  @ApiProperty()
  username!: string;

  @Expose()
  @ApiProperty()
  firstName!: string;

  @Expose()
  @ApiProperty()
  lastName!: string;

  @Expose()
  @ApiProperty()
  role!: string;

  @Expose()
  @ApiProperty()
  isActive!: boolean;

  @Expose()
  @ApiProperty()
  imageUrl?: string;

  @Expose()
  @ApiProperty()
  createdAt!: Date;

  @Expose()
  @ApiProperty()
  updatedAt!: Date;

  @Expose()
  @ApiProperty({ description: 'Computed full name' })
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  @Expose()
  @ApiProperty({ description: 'Avatar URL or default' })
  get avatar(): string {
    return this.imageUrl || '/assets/default-avatar.png';
  }
}
