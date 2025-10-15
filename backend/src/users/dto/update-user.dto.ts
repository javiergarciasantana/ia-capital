import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto, CreateUserProfileDto } from './create-user.dto';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserProfileDto extends PartialType(CreateUserProfileDto) { }

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateUserProfileDto)
    profile?: UpdateUserProfileDto;
}
