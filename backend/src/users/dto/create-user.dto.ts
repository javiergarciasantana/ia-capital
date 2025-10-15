import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsBoolean,
    IsDateString,
    ValidateNested,
    IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../user.entity';

export class CreateUserProfileDto {
    @IsOptional() @IsString() firstName?: string;
    @IsOptional() @IsString() lastName?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() country?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() address?: string;
    @IsOptional() @IsString() postalCode?: string;
    @IsOptional() @IsString() documentId?: string;
    @IsOptional() @IsDateString() birthDate?: string;

    @IsOptional() @IsString() preferredLanguage?: string;
    @IsOptional() @IsString() notes?: string;
}

export class CreateUserDto {
    @IsEmail() @IsNotEmpty()
    email!: string;

    @IsString() @IsNotEmpty()
    password!: string;

    // Como UserRole es un tipo unión, para validar usa IsIn
    @IsOptional() @IsIn(['client', 'admin', 'superadmin'])
    role?: UserRole;

    @IsOptional() @IsBoolean()
    isActive?: boolean;

    @IsOptional() @ValidateNested()
    @Type(() => CreateUserProfileDto)
    profile?: CreateUserProfileDto;
}
