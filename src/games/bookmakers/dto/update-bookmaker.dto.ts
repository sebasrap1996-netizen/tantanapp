import { IsString, IsNumber, IsOptional, IsBoolean, IsObject, MinLength, IsUrl } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateBookmakerDto } from './create-bookmaker.dto';

export class UpdateBookmakerDto extends PartialType(CreateBookmakerDto) {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre del bookmaker debe tener al menos 2 caracteres' })
  bookmaker?: string;

  @IsOptional()
  @IsString()
  bookmakerImg?: string;

  @IsOptional()
  @IsString()
  urlWebsocket?: string;

  @IsOptional()
  @IsString()
  apiMessage?: string;

  @IsOptional()
  @IsString()
  authMessage?: string;

  @IsOptional()
  @IsString()
  pingMessage?: string;

  @IsOptional()
  @IsNumber()
  scaleImg?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
